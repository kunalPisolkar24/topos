# Topos Seed Secrets

Seed Secrets copies an allowlisted subset of a Topos environment file into AWS
Systems Manager Parameter Store (SSM) and AWS Secrets Manager. It supports a
local Floci endpoint and real AWS, with guardrails for the latter.

Start with the [Seed Secrets documentation](docs/README.md).

## Quick preview

```bash
make install
make dry-run
```

A dry run reads and validates the environment file but does not write a value.
Use it before any real seed operation.
