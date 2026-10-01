# Gateway

The gateway is the only GraphQL endpoint Topos exposes to the outside world. It
runs [Apollo Router](https://www.apollographql.com/docs/router/) as a stock
binary, composed at build time from the `user` and `content` subgraph schemas.

It has **no source code**. Everything it does is declared in five files that
total 117 lines:

| File | Lines | What it declares |
| --- | --- | --- |
| [`router.yaml`](router.yaml) | 42 | Listeners, CORS, header propagation, health, telemetry, subgraph-error handling |
| [`supergraph.yaml`](supergraph.yaml) | 12 | Federation version, subgraph routing URLs, schema file locations |
| [`Dockerfile`](Dockerfile) | 25 | Compose the supergraph with Rover, then run the router image |
| [`compose.yml`](compose.yml) | 19 | Portable service definition (production stack) |
| [`compose.local.yml`](compose.local.yml) | 19 | Local stack definition |

## What it does

| Concern | Behaviour |
| --- | --- |
| Schema | Composes `services/user/schema.graphql` + `services/content/graph/schema.graphqls` into one supergraph **at image build time** |
| Routing | Plans each operation and sends every fetch to the subgraph that owns the field |
| Entities | Resolves `User` and `Post` across both subgraphs through `_entities` |
| Auth | Forwards the `Authorization` header and nothing else |
| CORS | Four allowed origins, credentials enabled |
| Health | `GET /health` on port `8088` |
| Metrics | Prometheus on `GET /metrics`, port `8088` |
| Tracing | OTLP/gRPC exporter to an OpenTelemetry collector |

## What it does *not* do

This matters as much as the list above:

- **No authentication or authorization.** There is no `authentication` block in
  `router.yaml`. Every subgraph decides for itself whether a token is valid.
- **No rate limiting, no query depth or complexity limits.**
- **No response caching or persisted queries.** Batching is disabled too
  (`BATCHING_NOT_ENABLED`).
- **No subscriptions or WebSocket transport.**
- **No custom plugins, no Rhai scripts.** The router image is stock.
- **No sandbox or landing page.** `GET /` returns `404`.

## Ports

| Port | Path | Published to the host? | Purpose |
| --- | --- | --- | --- |
| `4000` | `/graphql` | Yes | The federated API |
| `8088` | `/health` | **No** | Liveness probe, `{"status":"UP"}` |
| `8088` | `/metrics` | **No** | Prometheus scrape target |

Both compose files publish only `GATEWAY_EXT_PORT:GATEWAY_INT_PORT`, which
default to `4000:4000`. Port `8088` is reachable from inside the Docker
network — that is where `otel-collector` scrapes it — and from your machine only
via `docker exec`.

## Quick start

From the repository root, the gateway comes up as part of the whole stack:

```bash
make local-up
curl -s http://localhost:4000/graphql \
  -H 'content-type: application/json' \
  -d '{"query":"{ __typename }"}'
```

To compose the schema without building an image:

```bash
mkdir -p /tmp/subgraphs
cp services/user/schema.graphql            /tmp/subgraphs/user.graphql
cp services/content/graph/schema.graphqls  /tmp/subgraphs/content.graphql
cp gateway/supergraph.yaml                 /tmp/
APOLLO_ELV2_LICENSE=accept rover supergraph compose --config /tmp/supergraph.yaml
```

That is exactly what CI does. See
[Testing overview](docs/testing/overview.md).

## Ports and versions

| Setting | Value | Where |
| --- | --- | --- |
| Router image | `ghcr.io/apollographql/router:v1.38.0` | [`Dockerfile`](Dockerfile) |
| Federation version | `=2.10.3` (exact) | [`supergraph.yaml`](supergraph.yaml) |
| Composition tool | `rover supergraph compose` | [`Dockerfile`](Dockerfile), CI |
| GraphQL listen | `0.0.0.0:4000`, path `/graphql` | [`router.yaml`](router.yaml) |
| Health/metrics listen | `0.0.0.0:8088` | [`router.yaml`](router.yaml) |

The federation version is pinned with `=`, so the composed schema is byte-for-byte
reproducible and the router always understands it.

## Documentation

Full index: **[gateway/docs](docs/README.md)**.

| Topic | Guide |
| --- | --- |
| Run it and verify it | [Quick start](docs/getting-started/quickstart.md) |
| Every configuration key | [Configuration](docs/getting-started/configuration.md) |
| How the pieces fit | [Architecture](docs/concepts/architecture.md) |
| Entities and composition | [Federation](docs/concepts/federation.md) |
| One operation end to end | [Request flows](docs/concepts/request-flows.md) |
| Error codes and gaps | [Errors and limits](docs/components/errors-and-limits.md) |
| Health, metrics, traces | [Health and observability](docs/operations/health-and-observability.md) |
| Image and Compose | [Deployment](docs/operations/deployment.md) |
| Validate a change | [Testing overview](docs/testing/overview.md) |
