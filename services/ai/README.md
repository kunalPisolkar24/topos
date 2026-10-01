# AI service

The AI service is the intelligence layer of Topos. It generates summaries,
tags, and drafts; indexes and searches posts; answers grounded chat questions
with citations; and ranks personalised feeds.

It is a **single Python process** — unlike the [content service](../content/README.md),
which ships five binaries. Everything above runs in one `AIService` that is
composed from five application mixins:

| Concern | Mixin | RPCs |
| --- | --- | --- |
| Generation | `GenerationMixin` | `GenerateSummary`, `GenerateTags`, `GeneratePost` |
| Review workflow | `PostWorkflowMixin` | `GeneratePostDraft`, `ApprovePost`, `RejectPost` |
| Indexing & retrieval | `SearchMixin` | `IndexPost`, `DeletePost`, `SearchPosts`, `RelatedPosts`, `RelatedPostsBatch`, `Embed` |
| Grounded chat | `ChatMixin` | `ChatAnswer` (server-streaming) |
| Profiles & feed | `ProfilesMixin` | `UpdateUserProfile`, `RecommendFeed` |

The browser never calls this service. The content service is the only caller,
and it talks to it over gRPC — see
[Request flows](docs/concepts/request-flows.md).

> Two of the sixteen RPCs are effectively unused: `Embed` has no caller
> anywhere in the repo, and `DeleteUserProfile` is declared in the proto but
> **never implemented**, so it always returns `UNIMPLEMENTED`. Both are
> documented as-is in [RPC reference](docs/components/rpc-reference.md).

## Tech stack

| Layer | Technology | Where |
| --- | --- | --- |
| Runtime | Python 3.12, Poetry, `asyncio` + `grpc.aio` | [`pyproject.toml`](pyproject.toml) |
| Transport | gRPC (`grpcio` 1.83) + standard health checking | [`src/api/`](src/api), [`proto/ai/ai_service.proto`](proto/ai/ai_service.proto) |
| Orchestration | LangGraph state graphs with checkpointing | [`src/graphs/`](src/graphs) |
| LLM | OpenAI-compatible HTTP client (Lightning AI) + `tenacity` retries | [`src/llm.py`](src/llm.py) |
| Embeddings | Ollama, Qdrant Cloud inference, or deterministic fakes | [`src/embeddings.py`](src/embeddings.py) |
| Vector store | Qdrant (dense + sparse hybrid) with an in-memory twin | [`src/vector.py`](src/vector.py) |
| Session state | LangGraph `AsyncPostgresSaver` (optional — in-memory by default) | [`src/graphs/checkpointer.py`](src/graphs/checkpointer.py) |
| Configuration | `pydantic-settings` + AWS SSM/Secrets Manager hydration | [`src/config.py`](src/config.py) |
| Observability | `logging` JSON, Prometheus, OpenTelemetry, LangSmith | [`src/observability/`](src/observability) |
| Tests | `pytest`, `testcontainers`, k6, custom eval suites | [`tests/`](tests), [`load-tests/`](load-tests), [`scripts/`](scripts) |

## Quick start

From this directory (`services/ai/`):

```bash
poetry install      # install dependencies
make generate       # build the Python gRPC stubs into src/generated/
make run            # start the server
```

The gRPC server listens on **`:50051`** and Prometheus metrics on **`:12666`**.

> **There is no HTTP health endpoint.** Liveness and readiness are served over
> gRPC's standard health protocol for the service name `ai.AIService`. Use
> [`load-tests/healthcheck.py`](load-tests/healthcheck.py) or `grpcurl` to
> probe it; `curl localhost:50051/healthz` will not work.

Full walkthrough with verification steps:
[docs/getting-started/quickstart.md](docs/getting-started/quickstart.md).

> **The defaults are not all fake.** `LLM_MODE` defaults to `real`, so a bare
> `make run` with no `.env` will try to call the real language model with an
> empty API key. For a no-network run use:
>
> ```bash
> LLM_MODE=fake VECTOR_MODE=fake EMBEDDING_MODE=fake make run
> ```

## Endpoints

| Address | Protocol | Purpose |
| --- | --- | --- |
| `:50051` | gRPC | All 16 RPCs on `ai.AIService` |
| `:50051` | gRPC | Standard health service — `Check`, `Watch`, `SERVING`/`NOT_SERVING` |
| `:12666/metrics` | HTTP | Prometheus metrics (26 metrics, unprefixed names) |

Both ports are configurable through `PORT` and `METRICS_PORT`
([`src/config.py`](src/config.py)). Docker Compose publishes both to the host
by default.

## Common commands

Run from `services/ai/`:

| Command | What it does |
| --- | --- |
| `make install` | `poetry install` |
| `make generate` | Regenerate Python gRPC stubs from the proto |
| `make run` | Start the server (`python -m src.main`) |
| `make test` | Unit and in-process tests (`-m "not container"`) |
| `make test-coverage` | Same, with a coverage report |
| `make integration` | Container-backed integration tests (needs Docker) |
| `make lint` | `ruff check .` |
| `make format` | `ruff format .` |
| `make format-check` | `ruff format --check .` — CI-style, changes nothing |
| `make clean` | Remove generated stubs, caches, and coverage files |
| `make eval-chat` / `make eval-reco` | Evaluation suites against a running stack |
| `make load-test` | k6 load tests against an isolated stack |

> When the proto changes, run `make generate` **here** *and* in
> [`services/content`](../content) so both ends of the gRPC boundary stay in
> sync — see [Testing](docs/testing/overview.md).

## Documentation

Start at the documentation index: **[docs/README.md](docs/README.md)**.

| I want to… | Read |
| --- | --- |
| Run the service | [Quick start](docs/getting-started/quickstart.md) |
| Change a setting | [Configuration](docs/getting-started/configuration.md) |
| Understand the code layout | [Architecture](docs/concepts/architecture.md) |
| Understand collections, vectors, and state | [Data model](docs/concepts/data-model.md) |
| Follow a summary, tag, or draft | [Generation and review](docs/concepts/generation-and-review.md) |
| Follow a chat turn and its citations | [Chat flow](docs/concepts/chat-flow.md) |
| Understand search, profiles, and feeds | [Retrieval and recommendations](docs/concepts/retrieval-and-recommendations.md) |
| Trace a request end to end | [Request flows](docs/concepts/request-flows.md) |
| Call the API | [RPC reference](docs/components/rpc-reference.md) |
| Decode an error response | [Error handling](docs/components/error-handling.md) |
| Understand the provider boundary | [Providers](docs/components/providers.md) |
| Debug failures and degraded modes | [Reliability](docs/operations/reliability.md) |
| Wire up probes and metrics | [Health and observability](docs/operations/health-and-observability.md) |
| Run or write tests | [Testing](docs/testing/overview.md) |

## Related files

- **Proto contract**: [`proto/ai/ai_service.proto`](proto/ai/ai_service.proto)
- **Environment template**: [`.env.example`](.env.example)
- **Compose stacks**: [`infra/compose.yml`](infra/compose.yml) (dev),
  [`infra/compose.prod.yml`](infra/compose.prod.yml) (prod),
  [`infra/compose.load.yml`](infra/compose.load.yml) (load tests)
- **Build and run targets**: [`Makefile`](Makefile)
- **Container image**: [`Dockerfile`](Dockerfile) (multi-stage: codegen →
  builder → runtime)
- **Project-wide documentation**: [`../../docs/README.md`](../../docs/README.md)
