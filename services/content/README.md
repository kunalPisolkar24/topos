# Content service

The Content service owns everything a reader consumes in Topos: posts, tags,
chats, and reader interactions, plus the peer-review workflow that gets a post
published. It is an Apollo Federation subgraph, so the gateway merges its types
with the user service's.

Unlike the [user service](../user/README.md), this service is **not one
process**. It ships five binaries:

| Binary | Command | Port | Role |
| --- | --- | --- | --- |
| `content-service` | [`cmd/server`](cmd/server) | 4002 | GraphQL subgraph — all reads and writes |
| `content-worker` | [`cmd/worker`](cmd/worker) | 4003 | Generates AI summaries for new posts |
| `content-search-worker` | [`cmd/search-worker`](cmd/search-worker) | 4004 | Indexes posts into the vector store for search |
| `content-personalizer` | [`cmd/personalizer`](cmd/personalizer) | 4005 | Updates recommendation profiles from interactions |
| `content-dlq-replay` | [`cmd/dlq-replay`](cmd/dlq-replay) | — | Republishes dead-lettered Kafka messages |

The split matters: **a reader never waits for AI.** `createPost` returns as soon
as MongoDB has the canonical post; summary generation, search indexing, and
profile updates happen later, driven by Kafka. If the AI service is down, reads
and writes still work — you just get no summary and no search results for a
while.

> Ports 4003/4004/4005 are the **container-internal** ports set by Docker
> Compose — only `content-service` publishes a host port (`4002`), so worker
> `/healthz`, `/readyz`, and `/metrics` are reachable only from inside the
> Docker network (`docker compose exec content-worker curl -s localhost:4003/metrics`).
> In code every binary defaults to `PORT=4002`
> ([`internal/config/config.go`](internal/config/config.go)), so
> running them on the host requires setting `PORT` explicitly.

## Tech stack

| Layer | Technology | Where |
| --- | --- | --- |
| Runtime | Go 1.25 (module `github.com/kunalPisolkar24/topos/services/content`) | [`go.mod`](go.mod) |
| GraphQL | gqlgen v0.17.85, Apollo Federation v2 | [`graph/`](graph), [`gqlgen.yml`](gqlgen.yml) |
| Database | MongoDB 7 via the official driver | [`internal/db/`](internal/db), [`internal/repository/`](internal/repository) |
| Cache | Redis via `go-redis/v9`, circuit-breaker fail-open | [`internal/cache/`](internal/cache) |
| Messaging | Kafka via `segmentio/kafka-go` | [`internal/infrastructure/messaging/`](internal/infrastructure/messaging) |
| AI | gRPC client over the shared proto | [`internal/infrastructure/ai/`](internal/infrastructure/ai), [`proto/ai/`](proto/ai) |
| Auth | `golang-jwt/jwt/v5` (HS256) | [`internal/middleware/auth.go`](internal/middleware/auth.go) |
| Observability | `log/slog`, Prometheus, OpenTelemetry | [`internal/observability/`](internal/observability), [`internal/metrics/`](internal/metrics) |
| Tests | `go test`, testcontainers, k6 | [`internal/`](internal), [`load-tests/`](load-tests) |

## Quick start

From this directory (`services/content/`):

```bash
make up        # content-service + MongoDB + Kafka + Redis
make up-all    # ...plus all three workers
```

The subgraph is then at <http://localhost:4002/query> (a GraphQL playground is
served at <http://localhost:4002/>).

Full walkthrough with verification queries:
[docs/getting-started/quickstart.md](docs/getting-started/quickstart.md).

> `JWT_SECRET` and `INTERNAL_TOKEN` are **required** — the service refuses to
> start without them. Compose supplies `local-dev-secret` and
> `local-internal-secret`; a bare `go run ./cmd/server` needs a `.env`
> ([`.env.example`](.env.example)).

## Endpoints

| Path | Binary | Purpose |
| --- | --- | --- |
| `POST /query` | service | Federated GraphQL operations |
| `GET /` | service | GraphQL playground |
| `GET /healthz` | service, worker, search, personalizer | Liveness — is the process alive? |
| `GET /readyz` | service, worker, search, personalizer | Readiness — can it do its job? |
| `GET /metrics` | service, worker, search, personalizer | Prometheus metrics |
| `GET /internal/posts/{id}` | service | Post body for the AI service, guarded by `X-Internal-Secret` |

There is **no `/health` or `/ready` route** — the `z` suffixes are the real
paths. Each binary reports readiness against only the dependencies it actually
uses; see [Health and observability](docs/operations/health-and-observability.md).

## Common commands

Run from `services/content/`:

| Command | What it does |
| --- | --- |
| `make up` / `make up-service` | Start the API with dependencies |
| `make up-worker` | Summary worker |
| `make up-search` | Search-index worker |
| `make up-personalizer` | Recommendation-profile worker |
| `make up-all` | API + all three workers |
| `make down` / `make clean` | Stop (keep / delete volumes) |
| `make logs [SERVICE=name]` | Tail logs |
| `make ps` | List running containers |
| `make test` | Unit tests (no Docker) |
| `make test-integration` | Integration tests (testcontainers, needs Docker) |
| `make vet` | `go vet ./...` **and** `go vet -tags integration ./...` |
| `make fmt` | `gofmt -l .` — lists files that need formatting |
| `make coverage` | Unit coverage with the exclusion filter applied |
| `make generate` | Regenerate gRPC stubs from the proto |
| `make load-test` | k6 load tests against an isolated stack |

Degraded-mode runs use flags:

```bash
make up WITH_REDIS=0     # fail-open cache, no Redis container
make up WITH_MONGO=0     # boot degraded, /readyz returns 503
make up-worker WITH_KAFKA=0
```

> There is **no `make lint` target** despite it appearing in `.PHONY`. Use
> `make vet` and `make fmt`.
>
> `make generate` runs **only `protoc`** for the AI proto. gqlgen output is
> committed and regenerated with `go run github.com/99designs/gqlgen` — see
> [Testing](docs/testing/overview.md).

## Documentation

Start at the documentation index: **[docs/README.md](docs/README.md)**.

| I want to… | Read |
| --- | --- |
| Run the service | [Quick start](docs/getting-started/quickstart.md) |
| Change a setting | [Configuration](docs/getting-started/configuration.md) |
| Understand the code layout | [Architecture](docs/concepts/architecture.md) |
| Understand the collections and indexes | [Data model](docs/concepts/data-model.md) |
| Understand auth and permissions | [Authentication](docs/concepts/authentication.md) |
| Follow a post being published | [Publishing flow](docs/concepts/publishing-flow.md) |
| Follow the draft review workflow | [Draft lifecycle](docs/concepts/draft-lifecycle.md) |
| Follow a chat and its citations | [Chat flow](docs/concepts/chat-flow.md) |
| Follow a read query end to end | [Request flows](docs/concepts/request-flows.md) |
| Learn how caching degrades safely | [Caching and resilience](docs/concepts/caching-and-resilience.md) |
| Call the API | [GraphQL API](docs/components/graphql-api.md) |
| Decode an error response | [Error handling](docs/components/error-handling.md) |
| Debug failed background work | [Reliability, retries, and DLQ](docs/operations/reliability.md) |
| Wire up probes and metrics | [Health and observability](docs/operations/health-and-observability.md) |
| Run or write tests | [Testing](docs/testing/overview.md) |

## Related files

- **GraphQL schema**: [`graph/schema.graphqls`](graph/schema.graphqls)
- **Proto contract**: [`proto/ai/ai_service.proto`](proto/ai/ai_service.proto)
- **Environment template**: [`.env.example`](.env.example)
- **Compose stacks**: [`infra/compose.yml`](infra/compose.yml) (dev),
  [`infra/compose.prod.yml`](infra/compose.prod.yml) (prod),
  [`infra/compose.load.yml`](infra/compose.load.yml) (load tests)
- **Build and run targets**: [`Makefile`](Makefile)
- **Project-wide documentation**: [`../../docs/README.md`](../../docs/README.md)
