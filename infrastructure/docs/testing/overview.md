# Infrastructure verification

| Command | Verifies |
| --- | --- |
| `make infra-test-unit` | Terraform validation and mocked module contracts |
| `make infra-test-floci ENV=floci` | Live apply and Floci resource contracts |
| `make obs-test-unit` | Observability Terraform contracts |
| `make obs-test-live` | Read-only New Relic API/dashboard checks |
| `make obs-test-collector` | Production Compose and collector configuration validation |

Run a plan before an apply. Use Floci verification before relying on a real AWS
change whenever the same contract can be exercised there.
