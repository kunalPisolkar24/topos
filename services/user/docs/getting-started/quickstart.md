# Quick start

Get the User service running and prove it works. Two paths — pick one.

| Path | Best for | Prerequisites |
| --- | --- | --- |
| [A. Docker stack](#path-a-docker-stack-recommended) | Trying the service out, integration work | Docker |
| [B. Run on the host](#path-b-run-on-the-host) | Developing the service (hot reload) | Docker **and** Node 22 |

## Prerequisites

- **Docker** with Compose v2 — needed for both paths.
- **Node 22.14** for path B — the version pinned in [`.nvmrc`](../../.nvmrc):

  ```bash
  nvm use          # from services/user/
  node -v          # should print v22.14.0
  ```

## Path A: Docker stack (recommended)

From `services/user/`:

```bash
make up
```

This builds the image and starts four containers, waiting until each is healthy:

```mermaid
graph LR
    PG[user-postgres] --> M[user-migrator<br/>prisma migrate deploy]
    RD[user-redis] --> M
    M --> SVC[user-service<br/>:4001]
```

| Container | Role |
| --- | --- |
| `user-postgres` | PostgreSQL 16 (with a one-time init script that also creates the AI checkpointer role/database shared with the `ai` service) |
| `user-redis` | Redis 7 cache |
| `user-migrator` | One-shot: applies the Prisma migrations for the `User` table, then exits |
| `user-service` | The service itself, published on `localhost:4001` |

The service waits for Postgres and Redis to be healthy **and** for the migrator
to finish successfully, so `make up` returning means the schema is in place.

> The compose project name is `topos-user-local`, so it will not collide with
> the full-platform stack.

### Verify it

```bash
# 1. banner
curl -s http://localhost:4001/
# user service running

# 2. liveness and readiness — both should say ok
curl -s http://localhost:4001/health
# {"status":"ok","db":"ok","redis":"ok"}
curl -s http://localhost:4001/ready
# {"status":"ok","db":"ok","redis":"ok"}

# 3. Prometheus metrics are being exposed
curl -s http://localhost:4001/metrics | head -5
```

### A complete GraphQL session

```bash
BASE=http://localhost:4001/graphql

# Create an account
curl -s $BASE -H 'Content-Type: application/json' -d '{
  "query":"mutation { signup(email: \"alice@example.com\", username: \"alice\", password: \"correct-horse-123\") { token user { id username email } } }"
}'
```

Save the returned token, then use it:

```bash
TOKEN='<token from the signup response>'

# Who am I?
curl -s $BASE -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ me { id username email name } }"}'

# Update the profile
curl -s $BASE -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"query":"mutation { updateProfile(name: \"Alice\", bio: \"Hello\") { id name bio } }"}'

# List users (no auth needed)
curl -s $BASE -H 'Content-Type: application/json' \
  -d '{"query":"{ users(limit: 5) { id username createdAt } }"}'
```

For a friendlier client, open `http://localhost:4001/` in a GraphQL IDE — but
note that `NODE_ENV` defaults to `production` inside the container, which
disables introspection. Set `NODE_ENV=development` in your environment if you
want introspection-enabled tooling.

### Logs and shutdown

```bash
make logs     # follow all container logs
make down     # stop the stack (data is kept in volumes)
make clean    # stop and delete the volumes — wipes account data
```

## Path B: Run on the host

Use this when you are editing the code and want `tsx watch` to reload on save.

**1. Start only the dependencies** (not the service, which would take port
`4001`):

```bash
docker compose -f infra/compose.yml --project-name topos-user-local \
  up -d --wait user-postgres user-redis user-migrator
```

**2. Install and configure:**

```bash
npm ci
cp .env.example .env
```

Then edit **`.env`** so it points at the containers' **host** ports. Postgres is
`5432`, but Redis is published on **`6380`**, not `6379`:

```bash
DATABASE_URL=postgresql://topos_user:topos_pass@localhost:5432/topos_users
DATABASE_URL_MIGRATE=postgresql://topos_user:topos_pass@localhost:5432/topos_users
REDIS_URL=redis://localhost:6380
USER_JWT_SECRET=local-dev-secret-0123456789abcdef0123456789abcdef
```

> **Edit the canonical names** (`DATABASE_URL`, `REDIS_URL`), not the `USER_*`
> aliases. `.env.example` already sets both, and a value that is already set
> always wins — so changing only `USER_DATABASE_URL` would have no effect. The
> `USER_*` aliases exist for compose files and shared env files where the
> canonical name might collide with another service.

The `DATABASE_URL` shipped in `.env.example` is a placeholder
(`user:password@.../topos_user`) and will not match the compose database —
replace it as shown.

**3. Generate the Prisma client and run:**

```bash
make db-generate     # writes src/generated/ — required after a fresh clone
npm run dev          # tsx watch, reloads on change
```

You should see:

```
user service listening on 4001
```

Verify with the same curl commands as [path A](#verify-it).

> `src/generated/` is gitignored. If TypeScript complains that
> `./generated/prisma/client.js` does not exist, you forgot `make db-generate`.

## Run the tests

```bash
npm test                    # unit tests, no Docker needed
npm run test:integration    # needs Docker (Testcontainers spins up Postgres + Redis)
npm run lint                # tsc --noEmit + ESLint
```

Details: [Testing overview](../testing/overview.md).

## Load testing

An isolated stack (separate ports, its own Postgres and Redis) with k6:

```bash
make load-test                          # default scenario: mixed, 50 RPS
make load-test SCRIPT=signin            # a single scenario
make load-test SCRIPT=signup VUS=10 DURATION=2m
make load-test-cold                     # flush the cache first, then run
```

Valid `SCRIPT` values: `mixed`, `signup`, `signin`, `me`, `users`,
`update-profile`.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `port is already allocated` on 4001 | Another stack is running: `make down`, or set `USER_SERVICE_EXT_PORT=4010` |
| `make up` hangs waiting for `user-migrator` | Check `docker compose -f infra/compose.yml --project-name topos-user-local logs user-migrator` — a bad `DATABASE_URL_MIGRATE` shows up here |
| `Cannot find module './generated/prisma/client.js'` | Run `make db-generate` |
| `SERVICE_UNAVAILABLE` on every query | Postgres not running, or `.env` points at the wrong host/port |
| `redis: unavailable` in `/health` | Redis not running; the service still works, just uncached |
| `JWT_SECRET` validation error on startup | The secret is under 32 characters — use `openssl rand -hex 32` |
| EADDRINUSE on 4001 after path A | The container is still up: `make down` before running on the host |
| Changes to `prisma/schema.prisma` not picked up | `make db-generate`, and `make db-migrate` if you added a migration |
| `npm test` fails on import of the Prisma client | Same as above — generate first |

## Next steps

- [Configuration](configuration.md) — every setting and its default
- [Architecture](../concepts/architecture.md) — how the code is structured
- [Request flows](../concepts/request-flows.md) — what each operation does
- [GraphQL API](../components/graphql-api.md) — the full API reference
