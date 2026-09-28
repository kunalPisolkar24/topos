# AI service quick start

From `services/ai/`:

```bash
poetry install
make generate
make run
```

The gRPC server defaults to port `50051`; the metrics server defaults to
`12666`. The source defaults are in [`src/config.py`](../../src/config.py).

## Low-dependency development

Use fake modes when you want deterministic behaviour without external services:

```bash
LLM_MODE=fake VECTOR_MODE=fake EMBEDDING_MODE=fake make run
```

Fake vector mode keeps its index in memory. It is appropriate for local tests
and demos, not for verifying a persistent Qdrant integration.

Use the root `make local-up` to run the AI service with the other platform
services.
