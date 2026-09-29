# Health and observability

The AI service exposes Prometheus metrics on `METRICS_PORT` (default `12666`)
and emits structured JSON logs. OpenTelemetry export is optional through
`OTEL_EXPORTER_OTLP_ENDPOINT`.

## What to inspect

| Signal | Helps diagnose |
| --- | --- |
| RPC counters and latency | Slow or failing public gRPC calls |
| Qdrant dependency status/latency | Index and search availability |
| LLM call metrics | Generation provider failures or slowness |
| Retrieval and workflow metrics | Chat/search/recommendation behaviour |
| Structured trace IDs | Correlating service logs with an end-to-end request |

## Startup dependencies

Qdrant and, when configured, the checkpoint store have startup retry settings.
A fake vector mode removes the Qdrant requirement for local work. An unhealthy
upstream should be diagnosed alongside the content worker that made the gRPC
call; the worker is the component that retries and decides when to dead-letter
an event.

For the production telemetry pipeline, see
[observability architecture](../../../../infrastructure/docs/concepts/observability-architecture.md).
