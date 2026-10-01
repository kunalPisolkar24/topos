# User service

The User service owns accounts in Topos: signup, signin, profile fields,
password verification, and JWT issuance. It is an Apollo Federation subgraph,
so other services and the GraphQL gateway can reference a `User` by ID without
this service storing anything about posts.

Every other service treats it as the source of truth for *identity*. The
content subgraph reads the same signed JWT to authorize writes, which is why
its `JWT_SECRET`, issuer, and audience must stay aligned across services.

## Tech stack

| Layer | Technology | Where |
| --- | --- | --- |
| Runtime | Node 22 (ESM, TypeScript) | [`.nvmrc`](.nvmrc), [`tsconfig.json`](tsconfig.json) |
| HTTP server | [Hono](https://hono.dev/) + `@hono/node-server` | [`src/app.ts`](src/app.ts) |
| GraphQL | Apollo Server + `@apollo/subgraph` (Federation v2) | [`src/graphql/`](src/graphql) |
| Database | PostgreSQL via Prisma (pg adapter, explicit pool) | [`prisma/schema.prisma`](prisma/schema.prisma), [`src/lib/prisma.ts`](src/lib/prisma.ts) |
| Cache | Redis (optional, fail-open) | [`src/lib/cache.ts`](src/lib/cache.ts) |
| Auth | `jose` (HS256 JWT), `node:crypto` scrypt (passwords) | [`src/utils/`](src/utils) |
| Validation | Zod | [`src/schemas.ts`](src/schemas.ts) |
| Observability | pino, prom-client, OpenTelemetry | [`src/observability/`](src/observability) |
| Tests | Vitest (unit) + Testcontainers (integration) | [`src/**/__tests__/`](src), [`src/integration/`](src/integration) |

## Quick start

From this directory (`services/user/`):

```bash
make up      # Postgres + Redis + migrator + service (Docker)
```

The subgraph is then available at <http://localhost:4001/graphql>.

To run on the host instead (hot reload during development):

```bash
npm ci
cp .env.example .env    # then edit DATABASE_URL, USER_JWT_SECRET, REDIS_URL
make db-generate         # generates the Prisma client into src/generated/
npm run dev
```

Full walkthrough, including verification queries and troubleshooting:
[docs/getting-started/quickstart.md](docs/getting-started/quickstart.md).

## Endpoints

| Path | Purpose |
| --- | --- |
| `POST /graphql` | Federated GraphQL operations |
| `GET /health`, `GET /healthz` | Liveness probes |
| `GET /ready`, `GET /readyz` | Readiness probes |
| `GET /metrics` | Prometheus metrics |
| `GET /` | Plain-text banner |

## Common commands

Run from `services/user/`:

| Command | What it does |
| --- | --- |
| `make up` / `make down` | Start / stop the local compose stack |
| `make logs` | Follow the stack's logs |
| `make dev` | Run the service on the host with hot reload |
| `make db-generate` | Regenerate the Prisma client after schema changes |
| `make db-migrate` | Create and apply a migration during development |
| `npm test` | Unit tests (no Docker needed) |
| `npm run test:integration` | Integration tests (Testcontainers, needs Docker) |
| `npm run lint` | `tsc --noEmit` + ESLint |
| `make load-test` | k6 load tests against an isolated stack |

## Documentation

Start at the documentation index: **[docs/README.md](docs/README.md)**.

| I want to… | Read |
| --- | --- |
| Run the service | [Quick start](docs/getting-started/quickstart.md) |
| Change a setting | [Configuration](docs/getting-started/configuration.md) |
| Understand the code layout | [Architecture](docs/concepts/architecture.md) |
| Understand the database tables | [Data model](docs/concepts/data-model.md) |
| Follow signup/signin | [Authentication flow](docs/concepts/authentication-flow.md) |
| Follow a request end to end | [Request flows](docs/concepts/request-flows.md) |
| Learn how caching degrades safely | [Caching and resilience](docs/concepts/caching-and-resilience.md) |
| Call the API | [GraphQL API](docs/components/graphql-api.md) |
| Decode an error response | [Error handling](docs/components/error-handling.md) |
| Wire up health checks and metrics | [Health and observability](docs/operations/health-and-observability.md) |
| Run or write tests | [Testing](docs/testing/overview.md) |

## Related files

- **Federated schema**: [`schema.graphql`](schema.graphql)
- **Prisma schema**: [`prisma/schema.prisma`](prisma/schema.prisma)
- **Environment template**: [`.env.example`](.env.example)
- **Compose stacks**: [`infra/compose.yml`](infra/compose.yml) (dev),
  [`infra/compose.prod.yml`](infra/compose.prod.yml) (Floci/AWS),
  [`infra/compose.loadtest.yml`](infra/compose.loadtest.yml) (k6)
- **Build and run targets**: [`Makefile`](Makefile)
- **Project-wide documentation**: [`../../docs/README.md`](../../docs/README.md)
