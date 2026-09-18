# CLI Reference

This document explains all command-line options for the Seed Secrets tool.

## Usage

```bash
python main.py [options]
```

## Arguments

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `--env-file` | No | `infra/docker/prod/.env` | Path to the dotenv file to read |
| `--endpoint-url` | No | `None` (real AWS) | AWS endpoint URL. Empty string = real AWS |
| `--region` | No | `ap-south-1` | AWS region for Secrets Manager |
| `--dry-run` | No | `false` | Preview mode, no writes |
| `--only` | No | `None` (all secrets) | Comma-separated secret name filter |
| `--force` | No | `false` | Allow overwriting Terraform-managed secrets |
| `--confirm-prod` | No | `false` | Required for real AWS writes without `--dry-run` |
| `--verbose` | No | `false` | Enable verbose logging |

## Examples

### Seed to Floci (Local Development)

```bash
python main.py \
  --env-file infra/docker/prod/.env \
  --endpoint-url http://localhost:4566
```

### Dry-Run (Preview)

```bash
python main.py \
  --env-file infra/docker/prod/.env \
  --endpoint-url http://localhost:4566 \
  --dry-run
```

### Seed to Real AWS

```bash
python main.py \
  --env-file infra/docker/prod/.env \
  --endpoint-url "" \
  --region ap-south-1 \
  --confirm-prod
```

### Seed Only Specific Secrets

```bash
python main.py \
  --env-file infra/docker/prod/.env \
  --endpoint-url http://localhost:4566 \
  --only detectai/web/secrets,detectai/gateway/secrets
```

### Verbose Output

```bash
python main.py \
  --env-file infra/docker/prod/.env \
  --endpoint-url http://localhost:4566 \
  --verbose
```

### All Options Combined

```bash
python main.py \
  --env-file infra/docker/prod/.env \
  --endpoint-url http://localhost:4566 \
  --region ap-south-1 \
  --only detectai/web/secrets \
  --dry-run \
  --verbose
```

## Makefile Shortcuts

### Root Makefile (from project root)

| Command | Equivalent To | Description |
|---------|---------------|-------------|
| `make seed-install` | `poetry -C tools/seed-secrets install` | Install dependencies |
| `make seed-floci` | `poetry run main.py --endpoint-url http://localhost:4566` | Seed to Floci |
| `make seed-floci-dry` | `poetry run main.py --endpoint-url http://localhost:4566 --dry-run` | Preview Floci seed |
| `make seed-aws` | `poetry run main.py --endpoint-url "" --confirm-prod` | Seed to real AWS |
| `make seed-dry` | `poetry run main.py --dry-run` | Preview against current endpoint |

### Per-Tool Makefile

| Command | Description |
|---------|-------------|
| `make install` | Install dependencies with Poetry |
| `make lint` | Run ruff linter |
| `make test` | Run unit tests (no network) |
| `make test-all` | Run all tests (unit + integration) |
| `make test-cov` | Run tests with coverage report (65% gate) |
| `make dry-run` | Floci dry-run |
| `make seed-floci` | Seed to Floci |
| `make clean` | Remove cache and coverage files |

## Output

### Success Output (Floci)

```
target=Floci (http://localhost:4566) region=ap-south-1 env-file=infra/docker/prod/.env
found 8 allowlisted keys in .env: GITHUB_ID, GITHUB_SECRET, GOOGLE_ID, ...
created    detectai/web/secrets (8 keys)
created    detectai/gateway/secrets (2 keys)
created    detectai/inference/secrets (2 keys)

Done. Wrote 3 secrets to Floci (http://localhost:4566).

Verify: aws --endpoint-url http://localhost:4566 --region ap-south-1 secretsmanager list-secrets --query 'SecretList[].Name'
```

### Dry-Run Output

```
[dry-run] target=Floci (http://localhost:4566) region=ap-south-1 env-file=infra/docker/prod/.env
found 8 allowlisted keys in .env: GITHUB_ID, GITHUB_SECRET, GOOGLE_ID, ...
dry-run     detectai/web/secrets (8 keys)
dry-run     detectai/gateway/secrets (2 keys)
dry-run     detectai/inference/secrets (2 keys)

Generated 3 keys (not in .env, created once and synced):
  - INTERNAL_API_KEY (synced to web + gateway)
  - AI_SERVICE_API_KEY/API_KEY (synced to web + inference)
  - NEXTAUTH_SECRET

Hint: add generated values to your .env to keep them stable across runs.

[dry-run] no secrets were written.
```

### Error Output

```
ERROR: refusing to write to real AWS without --confirm-prod (or use --dry-run to preview)
```

```
ERROR: refusing to touch TF-managed secret detectai/pg/urls without --force
```

```
ERROR: failed to upsert detectai/web/secrets: Secrets Manager error (redacted — contains secret material)
```

## Exit Codes

| Code | Meaning | When |
|------|---------|------|
| `0` | Success | Seed completed (or dry-run previewed) |
| `1` | Runtime error | AWS write failed (`SecretsWriteError`) |
| `2` | Usage/config error | Bad args, missing env file, guard blocked, unknown secret |

## Tips

1. **Always dry-run first** — Use `--dry-run` before any real seed to see what would happen
2. **Use `--only` for partial seeds** — Seed just one service without touching others
3. **Check the banner** — The tool prints target, region, and env file before doing anything
4. **Generated keys are shown by name** — Never by value; add them to `.env` manually

## Related Documentation

- [Configuration](../getting-started/configuration.md) - Environment variables and settings
- [Validation & Guards](validation.md) - Safety guard rules
- [Secrets Mapping](secrets-mapping.md) - Which keys go to which secret
- [Seeding Flow](../concepts/seeding-flow.md) - What happens during a seed
