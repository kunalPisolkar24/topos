# Configuration

Topos uses environment variables for local and managed environments. Do not
put real secrets in tracked files.

## Local environment

The root Makefile uses:

```text
infrastructure/docker/local/.env.local
```

It creates that file from `.env.local.example` when `make local-up` runs for
the first time. Edit the generated file only when you need to change a local
setting.

## Managed environment

The production Compose command uses:

```text
infrastructure/docker/prod/.env
```

The root `make prod-up` target creates it from `.env.example` if necessary.
In managed mode, application services can load configuration from AWS Systems
Manager Parameter Store (SSM) and private values from AWS Secrets Manager.
Use the [Seed Secrets guide](../../tools/seed-secrets/docs/README.md) to
understand the guarded seeding workflow.

## Precedence and safety

Task definitions and Compose environment values can supply a setting directly;
service configuration then fills missing values from managed configuration.
The exact settings differ by service, so use the component guide before
changing a value. The source mapping for seeded values is
[`tools/seed-secrets/src/domain/constants.py`](../../tools/seed-secrets/src/domain/constants.py).

> [!TIP]
> Use a local fake mode for AI-related work where available. It allows tests and
> development to run without real model credentials or external AI calls.
