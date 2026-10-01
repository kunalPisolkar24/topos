# AI service quick start

From `services/ai/`:

```bash
poetry install     # 1. install dependencies
make generate      # 2. build the gRPC stubs into src/generated/
make run           # 3. start the server
```

`make run` executes `python -m src.main`
([`src/main.py`](../../src/main.py)). Two ports come up:

| Port | Protocol | What it serves |
| --- | --- | --- |
| **50051** | gRPC | The 16 RPCs on `ai.AIService`, plus the standard health service |
| **12666** | HTTP | `GET /metrics` — Prometheus scrape endpoint |

`make generate` is **not optional**. `src/generated/` is partly gitignored, so a
fresh clone has no `_pb2` modules and the server will not import. The target
runs `grpc_tools.protoc` and then rewrites the generated imports to be
relative (`sed -i 's/^import ai_service_pb2/from . import ai_service_pb2/'`) —
do not skip that step or hand-edit the files.

## Verify it is alive

**There is no HTTP health endpoint.** Health is served over gRPC's standard
protocol under the service name `ai.AIService`, so `curl localhost:50051/healthz`
fails. The repo ships a checker:

```bash
poetry run python load-tests/healthcheck.py && echo "SERVING"
```

It exits `0` when the service reports `SERVING`, `1` otherwise, and prints
nothing. That check is exactly what Docker Compose runs as its health check
([`infra/compose.yml`](../../infra/compose.yml)).

Metrics are plain HTTP:

```bash
curl -s localhost:12666/metrics | grep -E '^grpc_requests_total' | head
```

> **Startup is not instant.** The gRPC health service is only registered
> *after* the Qdrant and checkpoint retry loops succeed — up to
> `QDRANT_STARTUP_RETRIES` and `CHECKPOINT_STARTUP_RETRIES` attempts, 5 s
> apart (both default to `12`, i.e. ~60 s each). The metrics server, by
> contrast, starts immediately. So `:12666` answering while `:50051` refuses
> connections is normal, not a bug — see
> [Reliability](../operations/reliability.md).

## Call an RPC

Once `SERVING`, use the generated stubs directly:

```bash
PYTHONPATH=. poetry run python - <<'PY'
import grpc
from src.generated import ai_service_pb2, ai_service_pb2_grpc

with grpc.insecure_channel("localhost:50051") as channel:
    stub = ai_service_pb2_grpc.AIServiceStub(channel)

    summary = stub.GenerateSummary(
        ai_service_pb2.ContentRequest(text="<p>Topos indexes posts in Qdrant.</p>")
    )
    print("summary:", summary.summary)

    tags = stub.GenerateTags(
        ai_service_pb2.ContextRequest(title="Vector search", body="Qdrant hybrid")
    )
    print("tags:", list(tags.tags))
PY
```

With `LLM_MODE=fake` you get the canned responses baked into
`FakeLLMClient` ([`src/llm.py`](../../src/llm.py)):

```text
summary: A concise three-sentence summary generated for load testing.
tags: ['loadtest', 'capacity', 'benchmark', 'grpc', 'performance']
```

Those exact strings are the quickest way to prove you are talking to a live
server rather than a half-started one.

## Run it fully offline

```bash
LLM_MODE=fake VECTOR_MODE=fake EMBEDDING_MODE=fake make run
```

| Switch | What becomes fake | What still needs a server |
| --- | --- | --- |
| `LLM_MODE=fake` | `FakeLLMClient` returns canned text — no API key, no network | — |
| `VECTOR_MODE=fake` | `MemoryIndex` replaces Qdrant — index lives in process memory | — |
| `EMBEDDING_MODE=fake` | `FakeEmbeddingClient` hashes text into deterministic unit vectors | — |

All three together give a server with **zero external dependencies**, which is
what the k6 load tests use by default.

> `EMBEDDING_MODE=inference` is incompatible with `VECTOR_MODE=fake` — the
> in-memory twin has no server to embed for it, and startup raises
> `RuntimeError`. See [Configuration](configuration.md).

## Run the full stack with Docker

From the repository root:

```bash
docker compose -f services/ai/infra/compose.yml up -d --build
```

That starts the service plus Qdrant, an Ollama embedding server (and a
one-shot model init), and the shared user PostgreSQL used for chat
checkpoints. Compose defaults differ from the code defaults:

| Setting | Code default | Compose default |
| --- | --- | --- |
| `LLM_MODE` | `real` | **`fake`** |
| `EMBEDDING_MODE` | `fake` | **`ollama`** |
| `VECTOR_MODE` | `qdrant` | `qdrant` |
| `QDRANT_URL` | `http://localhost:6333` | `http://qdrant:6333` |
| `CHECKPOINT_DB_URL` | empty (in-memory) | the shared `user-postgres` |

So a Compose run gets real embeddings and real vector search while still
serving canned LLM output — the useful middle ground for developing against
Qdrant without an API key.

To use the real model, set `LIGHTNING_AI_API_KEY` and `AI_LLM_MODE=real` in
`services/ai/.env` (see [`.env.example`](../../.env.example)).

### Verify grounded chat

With the stack up:

```bash
poetry run python scripts/smoke_chat.py
```

It indexes a small factual corpus through `IndexPost`, streams answers from
`ChatAnswer`, prints the cited post ids, and scrapes token usage from
`/metrics`. It exits non-zero if a stream fails or an answer cites nothing.

## The rest of the platform

```bash
make local-up    # from the repo root — the whole stack, AI included
```

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `ModuleNotFoundError: No module named 'src.generated.ai_service_pb2'` | Stubs not generated | `make generate` |
| `:12666` answers but `:50051` refuses | Startup retries still running | Wait, or check logs for `qdrant not ready, retrying` |
| Health check never passes | Qdrant or Postgres unreachable past the retry budget | Check `QDRANT_URL` / `CHECKPOINT_DB_URL`, then restart |
| `pydantic_settings` validation error at import | A `Literal` setting has a bad value (`LOG_LEVEL`, `ENV_TYPE`, `*_MODE`) | Fix the value — this fails at *import*, before any log line |
| LLM calls fail with `401`/`403` | `LLM_MODE=real` with no `LLM_API_KEY` | Set the key, or run `LLM_MODE=fake` |
| Chat answers cite nothing | `CONTENT_INTERNAL_TOKEN` unset, so `get_post_body` is a placeholder | Set the token, or index content the fake embeddings can match |
| `Embedding dimension must be 1024` | The embedding model's output size ≠ `QDRANT_VECTOR_SIZE` | Align `QDRANT_VECTOR_SIZE` with the model, or recreate the collection |

## Next steps

- [Configuration](configuration.md) — every setting and the mode switches.
- [Architecture](../concepts/architecture.md) — what `serve()` does, in order.
- [Testing](../testing/overview.md) — how to run the suite before pushing.
