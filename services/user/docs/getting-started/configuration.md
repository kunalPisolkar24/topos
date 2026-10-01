# Configuration

Every setting the User service reads, what it defaults to, and where its value
comes from. Read this when setting up a new environment or when a setting is
not behaving as expected.

Configuration is validated **once, at startup**, by
[`src/config/env.ts`](../../src/config/env.ts) using Zod. A missing or invalid
value stops the process before it binds a port, with a message naming the
setting.

## How values are resolved

```mermaid
graph TD
    A[Process starts] --> B{ENV_TYPE?}
    B -->|dev| C[Load .env via dotenv]
    B -->|prod| D[Fetch SSM /topos/user/config<br/>+ Secrets Manager topos/user/secrets]
    D --> E[Fill only keys not<br/>already set and non-empty]
    C --> F["Apply USER_* aliases"]
    E --> F
    F --> G[Zod validates everything]
    G -->|invalid| H[Exit with a validation error]
    G -->|valid| I[Export env object]
```

Precedence, highest first:

1. **Already-set environment variables** (compose injection, an ECS task
   definition, an explicit `USER_*` value) — these always win.
2. **AWS SSM / Secrets Manager** in `ENV_TYPE=prod` — *fill-missing only*: a key
   is written only if it is absent or empty.
3. **`.env` file** (dev only, via `dotenv`).
4. **Zod defaults** from [`src/config/env.ts`](../../src/config/env.ts).

The `USER_*` alias pass runs before validation and copies an alias into its
canonical name only when the canonical one is unset.

> Values are never logged. The startup log in prod prints which *keys* came from
> which source (`KEY=ssm`, `KEY=sm`, `KEY=env`), never their contents.

## Core settings

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `ENV_TYPE` | no | `dev` | `dev` = local `.env`, zero AWS calls. `prod` = hydrate from SSM + Secrets Manager. |
| `NODE_ENV` | no | `development` | `production` disables GraphQL introspection |
| `PORT` | no | `4001` | HTTP listen port |
| `LOG_LEVEL` | no | `info` | `debug`, `info`, `warn`, `error` |

## Database

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | **yes** | — | Application pool connection string (may go through RDS Proxy) |
| `DATABASE_URL_MIGRATE` | no | falls back to `DATABASE_URL` | Used **only** by the migrator |
| `PG_POOL_MAX` | no | `10` | 1–100. Keep `tasks × pool_max` inside the proxy budget |
| `PG_POOL_IDLE_TIMEOUT_MS` | no | `30000` | Idle connections are closed after this |
| `PG_POOL_CONNECTION_TIMEOUT_MS` | no | `5000` | Borrow timeout; kept well under the proxy's 120 s so the app fails fast |

### Why two URLs

| URL | Goes through | Used by |
| --- | --- | --- |
| `DATABASE_URL` | RDS Proxy (pooler) — safe for ordinary queries | The running service |
| `DATABASE_URL_MIGRATE` | **Direct to the writer**, no pooler | `prisma migrate deploy` |

Migrations run DDL, advisory locks, and long transactions. Those pin or break
behind a connection pooler, so the migrate URL must never be pooled. This is
enforced, not just advised: in prod against real AWS, validation rejects a
migrate URL containing `pgbouncer=true`.

Both URLs must contain `sslmode=require` in prod because the proxy enforces
TLS. The app URL *may* use the pooler — Prisma's pg adapter issues unnamed
prepared statements, which do not pin proxy sessions.

## Authentication

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `JWT_SECRET` | **yes** | — | **Minimum 32 characters** — Zod rejects shorter values |
| `JWT_ISSUER` | no | `user-service` | Must match what the content service expects |
| `JWT_AUDIENCE` | no | `topos` | Must match what the content service expects |
| `JWT_EXPIRES_IN` | no | `7d` | Any value `jose` accepts (`30m`, `12h`, `7d`, …) |

Changing `JWT_SECRET` immediately invalidates every outstanding token. Rotate it
knowing that all users must signin again — and update the **content service**
with the same value at the same time.

## Redis (optional)

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `REDIS_URL` | no | — | Leave empty to disable caching entirely (the service works without Redis) |
| `REDIS_CACHE_TTL_MS` | no | `3600000` (1 h) | Normal TTL for cached users and list pages |
| `REDIS_MISSING_CACHE_TTL_MS` | no | `60000` (1 min) | TTL for cached `null` results (unknown IDs) |

See [Caching and resilience](../concepts/caching-and-resilience.md) for what is
and is not cached.

## Observability

| Variable | Default | Notes |
| --- | --- | --- |
| `LOG_LEVEL` | `info` | pino level; `password` and `token` fields are always redacted |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | *(empty = tracing disabled)* | See endpoint normalisation below |
| `OTEL_SERVICE_NAME` | `user-service` | Reported service name in traces |

The exporter endpoint is normalised in
[`src/observability/tracing.ts`](../../src/observability/tracing.ts):

- A missing scheme gains `http://`.
- Port `:4317` (OTLP gRPC) is rewritten to `:4318` — this service exports HTTP.
- A bare host with no port gains `:4318`.
- The path `/v1/traces` is appended.

So `otel-collector`, `otel-collector:4317`, and `http://otel-collector:4318`
all resolve to the same HTTP endpoint.

## AWS (prod only)

| Variable | Default | Notes |
| --- | --- | --- |
| `AWS_REGION` | `ap-south-1` | Region for SSM and Secrets Manager |
| `AWS_ENDPOINT_URL` | *(unset = real AWS)* | Set for Floci/LocalStack, e.g. `http://host.docker.internal:4566` |
| `USER_SECRETS_NAME` | `topos/user/secrets` | Secrets Manager secret ID (JSON object) |
| `USER_CONFIG_PARAM` | `/topos/user/config` | SSM parameter name (JSON string) |

Both sources hold a JSON object of setting names to values. Keys are injected
into `process.env` only when not already set, so an explicit value always wins.
The destination mappings themselves are maintained by Terraform and the
Seed Secrets tool — see
[Terraform configuration ownership](../../../../infrastructure/docs/components/configuration-and-secrets.md).

The startup log reports how many keys came from each source:

```
[env] ENV_TYPE=prod hydrated 9 SSM + 6 SM keys from Floci (http://host.docker.internal:4566) DATABASE_URL=sm, JWT_SECRET=sm, ...
```

If `DATABASE_URL` or `JWT_SECRET` is still unset after hydration, the service
warns that the secret store was likely unreachable — and Zod then fails anyway,
which is intentional: in prod these must come from the secret store, never from
a compose default.

## `USER_*` aliases

Local `.env` files and compose use a `USER_` prefix to avoid colliding with
other services sharing an env file. These are folded into their canonical names
at startup:

| Alias | Canonical |
| --- | --- |
| `USER_DATABASE_URL` | `DATABASE_URL` |
| `USER_DATABASE_URL_MIGRATE` | `DATABASE_URL_MIGRATE` |
| `USER_REDIS_URL` | `REDIS_URL` |
| `USER_JWT_SECRET` | `JWT_SECRET` |
| `USER_LOG_LEVEL` | `LOG_LEVEL` |
| `USER_CACHE_TTL_MS` | `REDIS_CACHE_TTL_MS` |
| `USER_MISSING_CACHE_TTL_MS` | `REDIS_MISSING_CACHE_TTL_MS` |
| `USER_PG_POOL_MAX` | `PG_POOL_MAX` |
| `USER_PG_POOL_IDLE_TIMEOUT_MS` | `PG_POOL_IDLE_TIMEOUT_MS` |
| `USER_PG_POOL_CONNECTION_TIMEOUT_MS` | `PG_POOL_CONNECTION_TIMEOUT_MS` |

> The alias is only applied when the canonical name is **not** already set. If
> both `DATABASE_URL` and `USER_DATABASE_URL` exist, `DATABASE_URL` wins.

## Compose-only variables

These are read by [`infra/compose.yml`](../../infra/compose.yml) and
[`Makefile`](../../Makefile), not by the application:

| Variable | Default | Purpose |
| --- | --- | --- |
| `USER_SERVICE_EXT_PORT` | `4001` | Host port mapped to the service |
| `USER_POSTGRES_EXT_PORT` | `5432` | Host port for Postgres |
| `USER_REDIS_EXT_PORT` | `6380` | Host port for Redis |
| `APP_NETWORK` | `topos_local_network` | Shared Docker network name |
| `WITH_POSTGRES` / `WITH_REDIS` | `1` | `make up` flags to start without a dependency |

## Environment examples

### Local, running on the host

Copy the template, then adjust:

```bash
# from services/user/
cp .env.example .env
```

`.env.example` ships with the values you are most likely to change:

```bash
ENV_TYPE=dev
NODE_ENV=development
PORT=4001
LOG_LEVEL=info
DATABASE_URL=postgresql://user:password@localhost:5432/topos_user
DATABASE_URL_MIGRATE=postgresql://user:password@localhost:5432/topos_user
USER_JWT_SECRET=local-dev-secret-0123456789abcdef0123456789abcdef
REDIS_URL=redis://user-redis:6379
REDIS_CACHE_TTL_MS=3600000
REDIS_MISSING_CACHE_TTL_MS=60000
```

For host development, point `DATABASE_URL` and `REDIS_URL` at `localhost` (and
`REDIS_URL` at port `6380`) instead of the compose hostnames — see
[Quick start, path B](quickstart.md#path-b-run-on-the-host).

> Because an already-set value always wins, the `USER_*` aliases in `.env` are
> ignored when the canonical name is also present. Edit the canonical name in a
> plain `.env` file; use the aliases when sharing an env file across services.

### Docker compose (`make up`)

The compose file supplies `ENV_TYPE=dev` and sensible defaults for everything
else, so `make up` works with no `.env` at all:

```yaml
environment:
  - ENV_TYPE=dev
  - DATABASE_URL=${USER_DATABASE_URL:-postgresql://topos_user:topos_pass@user-postgres:5432/topos_users}
  - JWT_SECRET=${USER_JWT_SECRET:-local-dev-secret-0123456789abcdef0123456789abcdef}
  - REDIS_URL=${USER_REDIS_URL:-redis://user-redis:6379}
  - NODE_ENV=${NODE_ENV:-production}
```

Note `NODE_ENV` defaults to `production` inside the container (introspection
off) even though `ENV_TYPE` is `dev` — they control different things.

### Managed / prod

```bash
ENV_TYPE=prod
AWS_REGION=ap-south-1
AWS_ENDPOINT_URL=http://host.docker.internal:4566   # Floci; omit for real AWS
# DATABASE_URL, JWT_SECRET come from topos/user/secrets
# PG_POOL_MAX, LOG_LEVEL, ... come from /topos/user/config
```

Both the service **and** the migrator perform this hydration — the migrator
duplicates it in [`scripts/migrator-run.mjs`](../../scripts/migrator-run.mjs)
because it runs as a separate container before the service starts.

## Validation failures

Validation runs through Zod, and the reported message names the offending
setting. The common cases:

| Failing setting | Cause | Fix |
| --- | --- | --- |
| `DATABASE_URL` | Missing, or not a valid URL | Set `DATABASE_URL` or `USER_DATABASE_URL` (or ensure the secret exists), using `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Fewer than 32 characters | Use a random ≥32-char string: `openssl rand -hex 32` |
| `REDIS_URL` | Malformed Redis URL | `redis://host:6379` — or leave empty to disable caching |
| `PORT` | Outside 1–65535 | Use a valid port |
| `PG_POOL_MAX` | Outside 1–100 | Stay within the proxy budget |
| `LOG_LEVEL` | Not one of `debug`, `info`, `warn`, `error` | Use a supported level |
| `DATABASE_URL` (prod) | Missing `sslmode=require` in prod against real AWS | Append `?sslmode=require` |
| `DATABASE_URL_MIGRATE` (prod) | Missing `sslmode=require`, or contains `pgbouncer=true` | Append `?sslmode=require` and point it **directly** at the writer, never a pooler |

The TLS checks apply only when `ENV_TYPE=prod` **and** `AWS_ENDPOINT_URL` is
unset. A set endpoint means an emulator (Floci), whose docker-host URLs are
plaintext by design.

## Verifying the current configuration

```bash
# from services/user/ — service must be running
curl -s http://localhost:4001/health | jq
curl -s http://localhost:4001/metrics | grep -E '^(redis_connected|dependency_up)'
```

`/health` reports `db` and `redis` reachability, which is the visible outcome of
the connection settings. For the full list of probes and metrics see
[Health and observability](../operations/health-and-observability.md).

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Process exits immediately, Zod message on stderr | A required value is missing or out of range — the message names it |
| `SERVICE_UNAVAILABLE` on every query | `DATABASE_URL` points at a host that is not running, or Postgres is still starting |
| Works locally, fails in prod | Missing `sslmode=require`, or secrets not seeded in Secrets Manager |
| 401 on every request after a deploy | `JWT_SECRET` changed, or the content service has a different value |
| Redis never used (`redis_connected=0` always) | `REDIS_URL` empty, or it points at the wrong host/port |
| Migrations not applied | The `user-migrator` container did not complete successfully — the service waits on it |
| Tracing absent | `OTEL_EXPORTER_OTLP_ENDPOINT` unset (the service logs `tracing disabled` at startup) |

## Next steps

- [Quick start](quickstart.md) — run the service end to end
- [Caching and resilience](../concepts/caching-and-resilience.md) — how these
  settings shape failure behaviour
- [Health and observability](../operations/health-and-observability.md) — probes
  and metrics
