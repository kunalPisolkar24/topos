# User Service Load Tests (k6)

Self-contained load test rig for the user service. Everything runs in
Docker containers on a private `loadtest-net` network — no host installs,
no shared dev infra, no port collisions.

## Stack

| Container | Image | Purpose |
|---|---|---|
| `user-postgres` | `postgres:15-alpine` | Single primary, no replica |
| `user-redis` | `redis:7-alpine` | Single node, no sentinel, LRU-only |
| `user-migrate` | service `migrator` stage | One-shot `prisma migrate deploy` |
| `user-seed` | service `seed` stage | Inserts `SEED_USER_COUNT` users + mints JWTs |
| `user-service` | service `runtime` stage | The system under test |
| `k6` | `grafana/k6:latest` | Load driver |

## Quick start

```bash
# from repo root
make -C services/user load-test RPS=10 VUS=5 DURATION=10s

# or with the default (mixed scenario, 50 RPS, 20 VUS, 30s)
make -C services/user load-test
```

k6 prints its standard end-of-run summary. The exit code propagates:
threshold failures cause the Make target to fail (suitable for scripting).

## Scenarios

| `SCRIPT=` | Operation | Auth | Notes |
|---|---|---|---|
| `users-list` | `users(limit:20)` | none | Heaviest read path, no cache reuse |
| `user-by-id` | `user(id)` | none | DataLoader + cache hit on warmup |
| `me` | `me` | bearer | Pre-minted JWTs from seed |
| `signup` | `signup` | none | Fresh creds per iter; conflicts counted |
| `signin` | `signin` | none | Round-robin over seeded users |
| `signin-then-me` | signin → me | none → bearer | Chained auth flow |
| `mixed` (default) | weighted mix | mixed | `WEIGHTS` env tunable, default `reads:50,user:20,me:10,signin:10,signup:10` |

## Tunables (Make env)

| Var | Default | Meaning |
|---|---|---|
| `RPS` | `50` | Aggregate target rate (mixed splits it across scenarios) |
| `VUS` | `20` | Pre-allocated VUs per scenario (k6 may scale up to 2×) |
| `DURATION` | `30s` | Test wall clock |
| `SCRIPT` | `mixed` | One of the scenarios above |
| `WEIGHTS` | `reads:50,user:20,me:10,signin:10,signup:10` | Only used by `mixed` |
| `SEED_USER_COUNT` | `5000` | Pool of pre-seeded users |
| `USER_JWT_SECRET` | `local-loadtest-secret` | Must match between seed and service |
| `PG_MEM` `REDIS_MEM` `SVC_MEM` `K6_MEM` | `1G` `512mb` `768M` `384M` | Container memory caps |

## Common invocations

```bash
# Smoke test, 10s
make -C services/user load-test RPS=10 VUS=5 DURATION=10s

# Realistic steady-state, 2 min
make -C services/user load-test RPS=100 VUS=50 DURATION=2m

# Signup flood (exercises argon2)
make -C services/user load-test-signup RPS=5 VUS=20 DURATION=1m

# Chained auth flow
make -C services/user load-test-auth RPS=30 VUS=30 DURATION=5m

# Cold cache (FLUSHALL before run, useful for measuring Postgres path)
make -C services/user load-test-cold RPS=50 VUS=20 DURATION=30s

# Reweight the mix
make -C services/user load-test WEIGHTS=reads:80,signup:5,signin:15 DURATION=1m
```

## What k6 reports

- `http_req_duration{group:read}` — reads, p95<300, p99<800
- `http_req_duration{group:auth}` — auth, p95<1500, p99<3000 (argon2 floor)
- `http_req_failed{group:read|auth}` — error rate
- `signup_conflict` / `signup_success` / `signin_success` / `signin_invalid_creds` / `auth_errors` — custom counters
- `read_duration` / `auth_duration` — custom Trends

Read thresholds are tight (warm cache). Auth thresholds are loose
(argon2 dominates). If reads fail thresholds with a healthy service,
the cache is the suspect — scrape `http://localhost:4001/metrics`
manually for `cache_operations_total` to confirm.

## Inspecting cache state

```bash
# After a run (or during, in another terminal):
docker compose -p topos-user-loadtest exec user-redis redis-cli INFO stats
docker compose -p topos-user-loadtest exec user-redis redis-cli --scan --pattern 'user:v1:*' | head
```

## Cleanup

```bash
make -C services/user load-test-stop      # stop containers, remove volumes
make -C services/user load-test-clean    # alias for the same
```

All `topos-user-loadtest_*` containers and the `user_lt_pg_data` and
`seed_out` volumes are removed.

## Lifecycle

1. `compose up` starts `user-postgres` and `user-redis` (healthcheck wait)
2. `user-migrate` runs `prisma migrate deploy` (one-shot)
3. `user-seed` inserts users, mints JWTs, writes `/out/users.json` and `/out/tokens.json`
4. `user-service` starts; `/ready` returns 200 once Prisma + Redis are reachable
5. `k6` starts, reads `/out/*.json` in `setup()`, runs the chosen scenario
6. k6 exits with non-zero on threshold breach; the Makefile propagates the code
7. `load-test-stop` tears down all containers and volumes

The seed container is **idempotent**: if `user_lt_pg_data` is retained and
already holds ≥ `SEED_USER_COUNT` users, the insert is skipped (it still
rewrites `/out/*.json` from the existing rows).
