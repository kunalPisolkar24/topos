# Content service quick start

## Run the standalone stack

From `services/content/`:

```bash
make up
```

This starts the GraphQL API with MongoDB, Kafka, and the shared Redis
configuration defined in `infra/compose.yml`. Use the root `make local-up` when
you also need the frontend, gateway, user service, and AI service.

## Endpoints

| Endpoint | Purpose |
| --- | --- |
| `http://localhost:4002/query` | GraphQL subgraph |
| `http://localhost:4002/health` | API health |
| `http://localhost:4003/metrics` | Summary-worker metrics |
| `http://localhost:4004/metrics` | Search-worker metrics |
| `http://localhost:4005/metrics` | Personalizer metrics |

## Choose a process

| Command | Starts |
| --- | --- |
| `make up` | The GraphQL API and its dependencies |
| `make up-worker` | Summary worker |
| `make up-search` | Search-index worker |
| `make up-personalizer` | Recommendation-profile worker |
| `make up-all` | API and every worker |

The source command definitions are in the service [Makefile](../../Makefile).
