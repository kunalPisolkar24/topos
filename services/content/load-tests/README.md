# Content Service Load Tests (k6)

Self-contained load test rig for the content service. Everything runs in
Docker containers on a private `content-loadtest-net` network — no host installs,
no shared dev infra, no port collisions.

## Stack

| Container | Image | Purpose |
|---|---|---|
| `content-mongo` | `mongo:7.0` | Single primary, no journal |
| `content-redis` | `redis:7-alpine` | Single node, no sentinel, LRU-only |
| `content-kafka` | `apache/kafka:3.7.0` | Single-node KRaft (no ZK) |
| `content-init-kafka` | `apache/kafka:3.7.0` | One-shot `kafka-topics --create posts` |
| `content-seed` | service `seed` stage | Inserts `SEED_POST_COUNT` posts + tags, mints JWTs |
| `content-service` | service `content-service` stage | The system under test |
| `content-worker` | service `content-worker` stage | Async consumer (Kafka → AI → Mongo summary) |
| `k6` | `grafana/k6:latest` | Load driver |

## Quick start

```bash
# from repo root
make -C services/content load-test RPS=10 VUS=5 DURATION=10s

# or with default (mixed scenario, 50 RPS, 20 VUS, 30s)
make -C services/content load-test
```

k6 prints its standard end-of-run summary. The exit code propagates:
threshold failures cause the Make target to fail.

## Scenarios

| `SCRIPT=` | Operation | Auth | Notes |
|---|---|---|---|
| `posts-list` | `posts(page,limit)` | none | Paginated list, cycles pages 1-5 |
| `post-by-id` | `post(id)` | none | Single fetch, round-robin over seeded IDs |
| `tags-list` | `tags(query,limit)` | none | List all tags |
| `posts-by-tag` | `postsByTag(tag,page,limit)` | none | Round-robin over seeded tags |
| `create-post` | `createPost(input)` | bearer | Pre-minted JWTs from seed |
| `create-and-verify` | createPost → poll → verify summary | bearer | End-to-end: API → Kafka → Worker → Mongo |
| `mixed` (default) | weighted mix | mixed | `WEIGHTS` env tunable |

## Tunables (Make env)

| Var | Default | Meaning |
|---|---|---|
| `RPS` | `50` | Aggregate target rate (mixed splits it across scenarios) |
| `VUS` | `20` | Pre-allocated VUs per scenario |
| `DURATION` | `30s` | Test wall clock |
| `SCRIPT` | `mixed` | One of the scenarios above |
| `WEIGHTS` | `reads:50,post:20,tag:10,bytag:10,create:10` | Only used by `mixed` |
| `SEED_POST_COUNT` | `5000` | Pool of pre-seeded posts |
| `CONTENT_JWT_SECRET` | `local-loadtest-secret` | Must match between seed and service |
| `MONGO_MEM` `REDIS_MEM` `KAFKA_MEM` `SVC_MEM` `WORKER_MEM` `K6_MEM` | `1G` `512mb` `768M` `768M` `512M` `384M` | Container memory caps |

## Common invocations

```bash
# Smoke test, 10s
make -C services/content load-test RPS=10 VUS=5 DURATION=10s

# Realistic steady-state, 2 min
make -C services/content load-test RPS=100 VUS=50 DURATION=2m

# Read-only: posts list
make -C services/content load-test-posts-list RPS=200 VUS=10 DURATION=1m

# Write-heavy: create posts
make -C services/content load-test-create-post RPS=20 VUS=10 DURATION=2m

# Full pipeline: create + verify worker processed it
make -C services/content load-test-create-verify RPS=5 VUS=5 DURATION=1m

# Cold cache (FLUSHALL before run)
make -C services/content load-test-cold RPS=50 VUS=20 DURATION=30s

# Reweight the mix
make -C services/content load-test WEIGHTS=reads:80,create:20 DURATION=1m
```

## What k6 reports

- `http_req_duration{group:read}` — reads, p95<200, p99<500
- `http_req_duration{group:write}` — writes, p95<1500, p99<3000
- `http_req_failed{group:read|write}` — error rate
- `e2e_latency` — create-to-verified-summary latency (p95<5s)
- `create_success` / `create_conflict` / `create_errors` — custom counters
- `verify_success` / `verify_timeout` — e2e verification counters
- `read_duration` / `write_duration` / `e2e_latency` — custom Trends

## Inspecting state

```bash
# After a run (or during, in another terminal):
docker compose -p topos-content-loadtest exec content-redis redis-cli INFO stats
docker compose -p topos-content-loadtest exec content-mongo mongosh --quiet --eval 'db.posts.countDocuments()'
docker compose -p topos-content-loadtest exec content-kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --group content-summary-worker-group --describe
```

## Cleanup

```bash
make -C services/content load-test-stop
make -C services/content load-test-clean   # alias
```

All containers and volumes are removed.

## Lifecycle

1. `compose up` starts `content-mongo`, `content-redis`, `content-kafka` (healthcheck wait)
2. `content-init-kafka` creates the `posts` topic
3. `content-seed` inserts posts/tags into Mongo, mints JWTs, writes `posts.json`, `tokens.json`, `tags.json` to `k6/seed_data/`
4. `content-service` starts; `/health` returns 200 once Mongo + Redis + Kafka are reachable
5. `content-worker` starts; consumes from Kafka, generates summaries (via noop AI fallback)
6. `k6` starts, reads seed files via `open()` at init context, runs the chosen scenario
7. k6 exits with non-zero on threshold breach; Makefile propagates the code
8. `load-test-stop` tears down all containers and volumes

The seed container is **idempotent**: if Mongo already holds `>= SEED_POST_COUNT` posts,
the insert is skipped (it still rewrites the seed data files from the existing rows).
