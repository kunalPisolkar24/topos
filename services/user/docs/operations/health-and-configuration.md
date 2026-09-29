# Health and configuration

The service exposes GraphQL, health/readiness, and metrics through its Hono
application. PostgreSQL is required for normal account work; Redis is an
optional cache that can fail open.

## Configuration sources

In managed mode, the service reads non-secret settings from `/topos/user/config`
and private values from `topos/user/secrets`, filling values that are absent
from the explicit environment. The destination mappings are maintained by
Terraform and the Seed Secrets tool.

## Database URLs

The runtime application URL can use an RDS Proxy. The migration URL must target
the direct writer, because DDL can pin or fail behind a connection pooler. This
is why `DATABASE_URL` and `DATABASE_URL_MIGRATE` are separate settings.

See [Terraform configuration ownership](../../../../infrastructure/docs/components/configuration-and-secrets.md).
