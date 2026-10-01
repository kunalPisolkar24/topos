# Configuration

There are two configuration files and nothing else. This page documents every
key, every environment variable, and gives copy-pasteable recipes for the
changes people actually make.

## New to this service?

Read [Quick start](quickstart.md) first if you have not run the gateway yet.
Then come back — you will not guess a key's meaning from the YAML alone,
because several of them do not behave the way their name suggests.

## How configuration is loaded

| Source | Value | Wins over environment? |
| --- | --- | --- |
| `APOLLO_ROUTER_CONFIG_PATH` | `/dist/config/router.yaml` | — |
| `APOLLO_ROUTER_SUPERGRAPH_PATH` | `/dist/schema/supergraph.graphql` | — |
| `--config` flag in `CMD` | same path again | **Yes** — the flag is what the binary actually reads |
| `--supergraph` flag in `CMD` | same path again | **Yes** |

Both files are baked into the image by `gateway/Dockerfile`. Consequences:

- **Changing either file requires an image rebuild.** `docker compose restart`
  is not enough; it re-reads nothing, because there is nothing to re-read from
  the host.
- **The environment cannot override YAML keys.** Only the two `${env.*}`
  expressions inside the YAML are substituted at boot. Everything else is
  static until you rebuild.
- **`${env.*}` is evaluated when the process starts**, so `docker compose up -e
  ...` or `docker run -e ...` changes do take effect on restart without a
  rebuild.

## `router.yaml`, all 42 lines

```yaml
cors:
  origins:
    - "http://localhost:3000"
    - "http://localhost:5173"
    - "${env.FRONTEND_PUBLIC_ORIGIN:-http://localhost:3000}"
    - "https://studio.apollographql.com"
  allow_credentials: true
  allow_headers:
    - "Content-Type"
    - "Authorization"
    - "X-Internal-Secret"

supergraph:
  listen: 0.0.0.0:4000
  path: /graphql
  introspection: true

health_check:
  path: /health
  listen: 0.0.0.0:8088

include_subgraph_errors:
  all: true

telemetry:
  exporters:
    metrics:
      prometheus:
        enabled: true
        listen: 0.0.0.0:8088
    tracing:
      otlp:
        enabled: true
        endpoint: ${env.OTEL_TRACING_ENDPOINT:-http://otel-collector:4317}

headers:
  all:
    request:
      - propagate:
          named: "Authorization"
```

## Key reference

| Key | Value | Effect | Verified |
| --- | --- | --- | --- |
| `cors.origins` | 4 entries | Only these origins get `access-control-allow-origin` echoed back | Yes — see [Errors and limits](../components/errors-and-limits.md#cors-failures-do-not-block-the-request) |
| `cors.allow_credentials` | `true` | Sends `access-control-allow-credentials: true` | Yes |
| `cors.allow_headers` | 3 entries | Headers the browser may include in a preflight | Yes — but only `Authorization` is forwarded onward |
| `supergraph.listen` | `0.0.0.0:4000` | GraphQL bind address and port | Yes |
| `supergraph.path` | `/graphql` | The only route served on 4000 | Yes — `/` and `/health` return 404 there |
| `supergraph.introspection` | `true` | Full introspection allowed from any caller | Yes |
| `health_check.path` | `/health` | Health route | Yes |
| `health_check.listen` | `0.0.0.0:8088` | Health bind address — **not** 4000 | Yes |
| `include_subgraph_errors.all` | `true` | Subgraph error messages reach the client verbatim | Yes — both states measured |
| `telemetry.exporters.metrics.prometheus` | `enabled`, `0.0.0.0:8088` | Metrics on the same port as health | Yes |
| `telemetry.exporters.tracing.otlp` | `enabled`, gRPC endpoint | OTLP/gRPC trace export | Attempted; fails locally (see below) |
| `headers.all.request.propagate.named` | `Authorization` | The one header forwarded to subgraphs | Yes — the others are dropped |

## CORS

### The four origins

| Origin | Why it is there |
| --- | --- |
| `http://localhost:3000` | The production frontend, served over HTTP in local dev |
| `http://localhost:5173` | The Vite dev server (`npm run dev`) |
| `${env.FRONTEND_PUBLIC_ORIGIN:-http://localhost:3000}` | The deployed frontend's real origin |
| `https://studio.apollographql.com` | Apollo Studio, for ad-hoc queries |

The third entry uses the router's substitution syntax:

```text
${env.VARIABLE_NAME:-fallback value}
```

Set `FRONTEND_PUBLIC_ORIGIN=http://localhost:9999` and the gateway accepts
`http://localhost:9999` on the next restart — measured, with the default
`http://localhost:3000` no longer implied. Unset, it falls back to
`http://localhost:3000`. Only the **production** Compose block sets it; the
local stack relies on the fallback.

### What `allow_headers` does and does not do

`X-Internal-Secret` is listed, which makes it look like the browser can pass
the internal secret through the gateway. It cannot: `headers.all.request`
propagates only `Authorization`, so the gateway strips it before dialling a
subgraph. `X-Internal-Secret` is used on the direct AI-to-content `/internal/*`
path, which never touches port 4000.

`allow_headers` only describes what the **browser** may send in a preflight. It
says nothing about what reaches a subgraph.

## GraphQL listener

```yaml
supergraph:
  listen: 0.0.0.0:4000
  path: /graphql
  introspection: true
```

| Behaviour | Result |
| --- | --- |
| `POST /graphql` with a JSON body | The API |
| `POST /graphql` with a JSON array | `400 BATCHING_NOT_ENABLED` |
| `GET /graphql?query=...` | `400 CSRF_ERROR` unless a signing header is present |
| `GET /` | `404` — no landing page, no Sandbox |
| `GET /health`, `GET /metrics` | `404` — both live on 8088 |

`introspection: true` has no environment escape hatch. To turn it off you edit
the file and rebuild. Note it is under `supergraph`, not top level.

## Health check

```yaml
health_check:
  path: /health
  listen: 0.0.0.0:8088
```

Both listeners are on 8088, which is deliberate — one port for probes, one for
traffic. Port 8088 is **not published** by either Compose file, and the router
image contains neither `curl` nor `wget`, so probe it from a throwaway
container attached to the gateway's network namespace:

```bash
docker run --rm --network container:local-gateway curlimages/curl:latest -fsS http://localhost:8088/health
```

The response is always `{"status":"UP"}` with HTTP 200 while the process is
alive. There is no readiness signal that accounts for subgraph availability —
the gateway reports itself up even when both subgraphs are down. See
[Health and observability](../operations/health-and-observability.md).

## Subgraph errors

```yaml
include_subgraph_errors:
  all: true
```

| Value | What the client sees |
| --- | --- |
| `true` | The subgraph's own message, verbatim, including internal detail |
| `false` | `"Subgraph errors redacted"` — `path` and `locations` kept |

Both states are documented with real payloads in
[Errors and limits](../components/errors-and-limits.md#include_subgraph_errors).
Note the trailing space after `true` in the file; it is harmless YAML.

## Telemetry

```yaml
telemetry:
  exporters:
    metrics:
      prometheus:
        enabled: true
        listen: 0.0.0.0:8088
    tracing:
      otlp:
        enabled: true
        endpoint: ${env.OTEL_TRACING_ENDPOINT:-http://otel-collector:4317}
```

### Metrics

Prometheus scrapes itself onto the same port as health. `GET /metrics` returns
a little over 200 lines of `0.0.4` text (240 after a handful of requests) including:

| Metric | Meaning |
| --- | --- |
| `apollo_router_http_requests_total` | Requests by status and endpoint |
| `apollo_router_operations_total` | GraphQL operations by kind |
| `apollo_router_query_planning_time_*` | Histogram of plan time |
| `apollo_router_cache_hit_count_total` / `_miss_...` | In-memory cache |
| `apollo_router_lifecycle_license` | Gauge; `license_state="unlicensed"` is the community tier |

### Tracing

`endpoint` uses `${env.OTEL_TRACING_ENDPOINT:-http://otel-collector:4317}` —
gRPC on 4317, the collector's standard OTLP/gRPC port. The production stack
sets `OTEL_TRACING_ENDPOINT` explicitly.

**Locally there is no collector**, so the exporter retries and logs at ERROR
level roughly every 25 seconds:

```text
OpenTelemetry trace error ... dns error ...
```

`router.yaml` documents this as intentional: failures are logged and dropped,
and the router keeps serving. It is noisy but harmless. To silence it locally,
point `OTEL_TRACING_ENDPOINT` somewhere or disable the exporter.

### The startup warning

```text
WARN telemetry.instrumentation.spans.mode is currently set to 'deprecated',
either explicitly or via defaulting.
```

Expected with this configuration. The router wants an explicit choice between
the legacy and spec-compliant span implementation:

```yaml
telemetry:
  instrumentation:
    spans:
      mode: spec_compliant   # or: deprecated, to silence without changing behaviour
```

This is the only key you can add without changing any observable behaviour.

### `service.name` in traces

The production Compose block sets `OTEL_SERVICE_NAME=gateway`, and the router
picks it up — verified: with it, log resources read
`"service.name":"gateway"`; without it they read
`"service.name":"unknown_service:router"`. If your traces arrive unnamed, that
variable is missing.

## Header propagation

```yaml
headers:
  all:
    request:
      - propagate:
          named: "Authorization"
```

Every list entry adds one more header. The default forwards exactly one:

| Client sends | Subgraph receives |
| --- | --- |
| `Authorization: Bearer ...` | yes |
| anything else | dropped |

This is also where you would add inbound header **removal** (for example,
stripping a header clients should not control) or renaming. Neither is
configured here.

## `supergraph.yaml`

The composition input, read by Rover at image build time — never by the router
at runtime:

```yaml
federation_version: =2.10.3

subgraphs:
  user:
    routing_url: http://user-service:4001/graphql
    schema:
      file: ./subgraphs/user.graphql

  content:
    routing_url: http://content-service:4002/query
    schema:
      file: ./subgraphs/content.graphql
```

| Key | Meaning |
| --- | --- |
| `federation_version` | Pinned **exactly** with `=`. Drives which `supergraph` plugin Rover downloads, and which join-spec version the output uses (`v0.3`) |
| `subgraphs.<name>.routing_url` | The address the router dials for that subgraph. Baked into the composed schema as `@join__graph(url:)` |
| `subgraphs.<name>.schema.file` | Where Rover reads that subgraph's SDL |

Two things people trip on:

1. **The file paths are relative to the Compose file's directory**, and the
   `Dockerfile` copies both schemas into `./subgraphs/` to match. If you add a
   subgraph, you must also add a `COPY` line for its schema.
2. **The `routing_url` paths differ on purpose**: user serves `/graphql`, the
   Go content service serves `/query`. Getting these backwards produces a
   subgraph error at request time, not a build failure.

Renaming a hostname in this file means renaming it everywhere — the Docker
network alias in Compose must match, or `SUBREQUEST_HTTP_ERROR` with a `dns
error` follows. See [Request flows](../concepts/request-flows.md#partial-failure).

## Environment variables

Only three, and none of them are read by application code:

| Variable | Read by | Default | Set where |
| --- | --- | --- | --- |
| `FRONTEND_PUBLIC_ORIGIN` | `router.yaml` CORS | `http://localhost:3000` | Production Compose block |
| `OTEL_TRACING_ENDPOINT` | `router.yaml` tracing | `http://otel-collector:4317` | Production Compose block |
| `OTEL_SERVICE_NAME` | The router's telemetry resources | `unknown_service:router` | Production Compose block, value `gateway` |

Plus the two the image sets for itself:

| Variable | Value |
| --- | --- |
| `APOLLO_ROUTER_CONFIG_PATH` | `/dist/config/router.yaml` |
| `APOLLO_ROUTER_SUPERGRAPH_PATH` | `/dist/schema/supergraph.graphql` |

No `APOLLO_*` key controls authentication, caching, or limits, because none of
those are configured.

## Recipes

Each recipe means **editing the file and rebuilding the image**.

### Allow a new browser origin

```yaml
cors:
  origins:
    - "http://localhost:3000"
    - "http://localhost:5173"
    - "http://localhost:8080"          # add
    - "${env.FRONTEND_PUBLIC_ORIGIN:-http://localhost:3000}"
    - "https://studio.apollographql.com"
```

Verify:

```bash
curl -s -D - -o /dev/null -X OPTIONS \
  -H "Origin: http://localhost:8080" \
  -H "Access-Control-Request-Method: POST" \
  http://localhost:4000/graphql | grep -i allow-origin
```

An allowed origin echoes back; a disallowed one omits the header entirely.

### Redact subgraph errors for a public deployment

```yaml
include_subgraph_errors:
  all: false
```

Clients then see `"Subgraph errors redacted"` with `path` intact. The frontend's
`getGraphQLErrorMessage` will show that string instead of the resolver detail.

### Move the GraphQL port

Change `supergraph.listen` **and** the Compose port mapping together:

```yaml
supergraph:
  listen: 0.0.0.0:4001
```

```yaml
ports:
  - "4001:4001"     # in gateway/compose.yml and gateway/compose.local.yml
```

Leaving the mapping as `4000:4001` works too, as long as the right-hand side
matches `listen`.

### Disable introspection

```yaml
supergraph:
  introspection: false
```

Takes effect only after a rebuild, and blocks `{ __typename }` as well as full
introspection queries.

### Point tracing at another collector

No rebuild needed — the endpoint is an expression:

```bash
OTEL_TRACING_ENDPOINT=http://otel-collector-local:4317 docker compose up -d gateway
```

## See also

| Topic | Page |
| --- | --- |
| What each key actually does at runtime | [Request flows](../concepts/request-flows.md) |
| Ports and what is published | [Architecture](../concepts/architecture.md) |
| Health and metrics probing | [Health and observability](../operations/health-and-observability.md) |
| Rebuilding after a change | [Deployment](../operations/deployment.md) |
