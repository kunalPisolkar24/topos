# CLI reference

Run the tool from `tools/seed-secrets/`:

```bash
poetry run python main.py [options]
```

| Option | Meaning |
| --- | --- |
| `--env-file PATH` | Environment file to read. |
| `--endpoint-url URL` | AWS-compatible endpoint; omit for real AWS. |
| `--region REGION` | AWS region, default `ap-south-1`. |
| `--dry-run` | Preview destinations and keys without writing. |
| `--only NAMES` | Comma-separated destination names to limit the run. |
| `--force` | Override specific safety guards. |
| `--confirm-prod` | Required for non-dry-run writes to real AWS. |
| `--verbose` | Enable verbose logs. |

The parser is implemented in [`src/cli/parser.py`](../../src/cli/parser.py).

## Useful examples

```bash
# Preview a specific SSM payload against Floci
poetry run python main.py \
  --env-file ../../infrastructure/docker/prod/.env \
  --endpoint-url http://localhost:4566 \
  --only /topos/frontend/config \
  --dry-run

# Write to real AWS only after an explicit acknowledgement
poetry run python main.py \
  --env-file ../../infrastructure/docker/prod/.env \
  --region ap-south-1 \
  --confirm-prod
```

Do not use `--force` merely to bypass an error. Read the guard message and
confirm the target and connection hosts first.
