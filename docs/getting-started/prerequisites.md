# Prerequisites

## Required for the full local stack

Install the following before using the root quick start:

| Tool | Why it is needed | Check it |
| --- | --- | --- |
| Docker Engine or Docker Desktop | Runs the full local platform and its data stores. | `docker --version` |
| Docker Compose plugin | Starts the composed local stack. | `docker compose version` |
| GNU Make | Provides the repository's short commands. | `make --version` |

Make sure Docker is running and that your account can run `docker ps` without
an error.

## Needed when working on one service

| Area | Runtime | Source |
| --- | --- | --- |
| Frontend | Node.js 20 | `.github/workflows/service-frontend.yaml`, `frontend/Dockerfile` |
| User service | Node.js 22 | `.github/workflows/service-user.yaml`, `services/user/Dockerfile` |
| Content service | Go 1.25 | `services/content/go.mod` |
| AI service | Python 3.12 and Poetry | `services/ai/pyproject.toml` |
| Seed Secrets | Python 3.11 and Poetry | `tools/seed-secrets/pyproject.toml` |
| Managed infrastructure | Terraform | `infrastructure/terraform/` |

You do not need every runtime just to run the full Docker stack.

## Next step

Continue to the [local quick start](quickstart.md).
