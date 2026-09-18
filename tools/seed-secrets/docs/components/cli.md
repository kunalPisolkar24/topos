# CLI Reference — Topos

## Usage

```bash
python main.py [options]
```

## Arguments

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `--env-file` | No | `infrastructure/docker/prod/.env` | Path to dotenv file |
| `--endpoint-url` | No | `None` (real AWS) | AWS endpoint URL. Empty = real AWS |
| `--region` | No | `ap-south-1` | AWS region |
| `--dry-run` | No | `false` | Preview, no writes |
| `--only` | No | `None` (all) | Comma-separated param/secret filter |
| `--force` | No | `false` | Allow TF-managed overwrite |
| `--confirm-prod` | No | `false` | Required for real AWS |
| `--verbose` | No | `false` | Verbose logging |

## Examples

### Seed to Floci

```bash
python main.py \
  --env-file infrastructure/docker/prod/.env \
  --endpoint-url http://localhost:4566
```

### Dry-Run

```bash
python main.py \
  --env-file infrastructure/docker/prod/.env \
  --endpoint-url http://localhost:4566 \
  --dry-run
```

### Real AWS

```bash
python main.py \
  --env-file infrastructure/docker/prod/.env \
  --endpoint-url "" \
  --region ap-south-1 \
  --confirm-prod
```

### Only Frontend

```bash
python main.py \
  --env-file infrastructure/docker/prod/.env \
  --endpoint-url http://localhost:4566 \
  --only /topos/frontend/config
```

## Makefile

| Command | Description |
|---------|-------------|
| `make install` | Poetry install |
| `make lint` | ruff check |
| `make test` | Unit tests |
| `make test-all` | All tests |
| `make test-cov` | Coverage 65% gate |
| `make dry-run` | Floci dry-run (frontend only) |
| `make seed-floci` | Seed to Floci (frontend only) |
| `make clean` | Remove caches |

## Output

### Success (Floci)

```
target=Floci (http://localhost:4566) region=ap-south-1 env-file=infrastructure/docker/prod/.env
found 11 allowlisted keys in .env: APP_NETWORK, FRONTEND_CONTAINER, VITE_GRAPHQL_URL, ...
created    /topos/frontend/config (11 keys)

Done. Wrote 1 secrets to Floci (http://localhost:4566).

Verify SM: aws --endpoint-url http://localhost:4566 --region ap-south-1 secretsmanager list-secrets --query 'SecretList[].Name'
Verify SSM: aws --endpoint-url http://localhost:4566 --region ap-south-1 ssm describe-parameters --query 'Parameters[].Name' | grep topos
```

### Dry-Run

```
[dry-run] target=Floci (http://localhost:4566) region=ap-south-1 env-file=infrastructure/docker/prod/.env
found 11 allowlisted keys in .env: APP_NETWORK, ...
dry-run     /topos/frontend/config (11 keys)

[dry-run] no secrets were written.
```

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Runtime (AWS write failed) |
| `2` | Usage/config (bad args, guard, unknown) |
