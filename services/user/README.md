# User Service

GraphQL (Apollo Federation subgraph) service for the Topos platform: account
signup/signin and user profiles. Written in TypeScript (Node 22) with Prisma
over Postgres and a Redis cache.

## API

| Operation | Description |
|---|---|
| `signup(email, username, password)` | create account → `AuthPayload` (JWT + user) |
| `signin(email, password)` | verify credentials → `AuthPayload` |
| `updateProfile(name, bio, ...)` | update the signed-in user's profile |
| `me` | the signed-in user |
| `user(id)` | user by id |
| `users(limit, cursor)` | paginated user directory |

`User` is a federated entity (`@key(id)`), resolvable by other subgraphs.

## Layout

```
src/
├── index.ts / app.ts     # entrypoint, Hono server, health + metrics routes
├── config/               # zod-validated env
├── graphql/              # typeDefs + resolvers (federation subgraph)
├── domain/               # user model, password hashing
├── repositories/         # Prisma data access
├── lib/                  # prisma, redis, cache, shutdown
├── observability/        # logging, metrics, tracing
├── utils/                # token (JWT) helpers
├── integration/          # container tests (testcontainers)
└── generated/            # prisma client (generated, gitignored)
```

## Quick start

```bash
docker compose up -d --build
```

Starts Postgres + Redis + migrator + the service on `:4001` with defaults — no
env file needed (equivalent to `make up`). For bare-metal dev: `npm ci`, copy
the user block from `infrastructure/docker/local/.env.local.example` into
`.env`, then `npm run dev`.

## Running the stack

The service runs as a single Postgres + Redis + service stack (`infra/compose.yml`):

```bash
make up     # builds and starts postgres + redis + migrator + service
make logs   # tail the logs
make down   # stop (keeps volumes)
make clean  # stop and delete volumes
```

No env file needed — defaults come from `infra/compose.yml`. The service is on
`:4001`; Postgres `:5432` (external port `USER_POSTGRES_EXT_PORT`), Redis
`:6380`.

`make local-up` / `local-down` / `local-logs` / `local-clean` are kept as
backwards-compatible aliases for `up` / `down` / `logs` / `clean`.

### Independent run

`make up` accepts optional flags to skip dependencies (caps canonical,
lowercase alias). The service stays up and degrades gracefully:

```bash
make up WITH_POSTGRES=0              # without postgres: GraphQL -> SERVICE_UNAVAILABLE (503), /ready 503, /health 200
make up WITH_REDIS=0                 # without redis: fail-open to postgres, reconnect on restart
make up WITH_POSTGRES=0 WITH_REDIS=0 # fully degraded

# lowercase aliases also work
make up with_postgres=0 with_redis=0
```

When postgres is disabled `DATABASE_URL` still points at the stopped host;
override with `USER_DATABASE_URL` for an external DB. When redis is disabled
`REDIS_URL` is kept for reconnect testing; set `USER_REDIS_URL=` (empty) to
disable the client entirely.

## Docker

`infra/compose.yml` is the single-instance topology (one Postgres, one Redis) used
standalone. Env is documented in `.env.example` (standalone) and
`infrastructure/docker/local/.env.local.example` (local full stack).

- `DATABASE_URL` is the app pool URL; `DATABASE_URL_MIGRATE` is used by the
  `user-migrator` and `prisma.config.ts`. They default to the same value
  (single Postgres) but are kept as separate vars so a future pooler (e.g.
  PgBouncer) can be inserted without code changes.
- `REDIS_URL` is a single Redis URL (e.g. `redis://user-redis:6379`);
  password, if needed, is encoded in the URL.

## Testing

```bash
npm test                  # unit tests (fast, no docker)
npm run test:integration  # container tests via testcontainers (needs Node 22)
npm run test:coverage     # unit tests with 85% coverage thresholds
make load-test            # k6 load tests against a compose stack
```

## Observability

- **Metrics**: Prometheus endpoint on `/metrics` — request and GraphQL
  counters/durations by operation + status, cache operations/invalidations.
- **Logs**: JSON lines to stdout (`service=user-service`, `operation`,
  `duration_ms`, `trace_id`/`span_id`) — ready for Loki.
- **Tracing**: optional OTLP export via `OTEL_EXPORTER_OTLP_ENDPOINT`.
