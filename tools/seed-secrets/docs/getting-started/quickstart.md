# Seed Secrets quick start

## 1. Install dependencies

From `tools/seed-secrets/`:

```bash
make install
```

This uses Poetry and the Python version declared in
[`pyproject.toml`](../../pyproject.toml).

## 2. Preview a Floci seed

```bash
make dry-run
```

By default, the Makefile previews
`infrastructure/docker/local/.env.local.example` against
`http://localhost:4566`. The command reports destination names and key counts,
but does not print values or write anything.

## 3. Seed Floci after reviewing the preview

```bash
make seed-floci
```

Make sure the Floci endpoint is running before the real write. You can override
the input and endpoint:

```bash
make dry-run ENV_FILE=../../infrastructure/docker/prod/.env ENDPOINT_URL=http://localhost:4566
```

## 4. Verify

The tool prints AWS CLI commands for listing the created Secrets Manager
secrets and SSM parameters. It never prints their values.

> [!WARNING]
> A non-empty endpoint identifies an emulator such as Floci. An empty endpoint
> means real AWS. Always use `--dry-run` first when changing targets.

Continue with [configuration](configuration.md) before targeting real AWS.
