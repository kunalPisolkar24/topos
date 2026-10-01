# Quick start

Bring the gateway up, prove it answers, and learn the four commands you will
reuse constantly. Every output below was captured from a real run of this
configuration.

## What you need

See [Prerequisites](../../../docs/getting-started/prerequisites.md). Short
version:

| Requirement | Why |
| --- | --- |
| Docker 20.10+ and Docker Compose | The gateway is a container image |
| GNU make | `make local-up` drives the stack |
| `curl` | Every check below uses it |
| Rover (optional) | Only if you want to compose the schema yourself |

## 1. Start the whole stack

From the repository root:

```bash
make local-up
```

The gateway cannot start on its own: it needs both subgraphs running and
resolvable by their Compose network names. `compose.local.yml` declares that
with `depends_on`.

Wait for it:

```bash
docker compose -f infrastructure/docker/local/compose.yml ps
```

Look for `local-gateway` in state `Up`.

## 2. Prove it answers

```bash
curl -s http://localhost:4000/graphql \
  -H 'content-type: application/json' \
  -d '{"query":"{ __typename }"}'
```

```json
{"data":{"__typename":"Query"}}
```

That response is worth a second look. You gave the gateway a query against a
schema it composed from two unrelated services, and it answered without ever
contacting either — `__typename` is resolved by the router itself. It is the
cheapest possible proof that the router is alive and the supergraph loaded.

### The check that actually touches both subgraphs

```bash
curl -s http://localhost:4000/graphql \
  -H 'content-type: application/json' \
  -d '{"query":"{ posts(page:1, limit:1) { posts { id title author { id username } } } }"}'
```

Two services answer this one request: content returns the posts and their
author ids, the router collects the ids, and user resolves `username` through a
single batched `_entities` call. See
[Federation](../concepts/federation.md) for the exact payloads.

### A query that fails on purpose

```bash
curl -s http://localhost:4000/graphql \
  -H 'content-type: application/json' \
  -d '{"query":"{ nosuchfield }"}'
```

```json
{"errors":[{"message":"parsing error: no field `nosuchfield` in type `Query`",
"extensions":{"code":"PARSING_ERROR"}}]}
```

HTTP **400**. Knowing which failures are `400` and which are `200` is the
single most useful debugging skill here — see
[Errors and limits](../components/errors-and-limits.md).

## 3. Check health

Health is **not** on port 4000. It lives on 8088, which neither Compose file
publishes, so you have to go through Docker:

```bash
docker exec local-gateway wget -qO- http://localhost:8088/health
```

```json
{"status":"UP"}
```

| Path | On port 4000 | On port 8088 inside the container |
| --- | --- | --- |
| `/graphql` | the API | — |
| `/health` | **404** | `200 {"status":"UP"}` |
| `/metrics` | **404** | Prometheus text |
| `/` | **404** (no landing page) | — |

Full detail in [Health and observability](../operations/health-and-observability.md).

## 4. Tear down

```bash
make local-down
```

## The four commands worth bookmarking

| Command | Does |
| --- | --- |
| `make local-up` / `make local-down` | Start/stop the whole stack, gateway included |
| `curl -s localhost:4000/graphql -H 'content-type: application/json' -d '{"query":"{ __typename }"}'` | Smoke-test the router |
| `docker exec local-gateway wget -qO- http://localhost:8088/health` | Probe health without publishing the port |
| `docker logs -f local-gateway` | Watch boot lines and errors |

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `curl: (7) Failed to connect to localhost port 4000` | Stack not running, or still starting | `docker compose -f infrastructure/docker/local/compose.yml ps`, then `docker logs local-gateway` |
| `Connection refused` on 8088 from the host | Expected — 8088 is never published | Use `docker exec`, as above |
| Boot log shows repeated `OpenTelemetry trace error ... dns error` | No collector on the local network | Harmless. `router.yaml` documents that export failures are logged and dropped |
| `WARN telemetry.instrumentation.spans.mode is currently set to 'deprecated'` | That key is not set | Expected; see [Configuration](configuration.md#telemetry) |
| `SUBREQUEST_HTTP_ERROR` with a `dns error` naming `user-service` or `content-service` | A subgraph is down, or its hostname does not resolve on that network | Restart the stack; check `supergraph.yaml` if you changed a hostname |
| `PARSING_ERROR` for a field you just added | The gateway image still has the old supergraph | Rebuild the gateway image — the schema is baked in at build time |
| `CSRF_ERROR` when curling with `?query=` | The router blocks simple GETs | Send a JSON POST instead |

## Where to go next

| If you want to... | Read |
| --- | --- |
| Understand what just happened | [Federation](../concepts/federation.md) |
| Change a setting | [Configuration](configuration.md) |
| Trace one request fully | [Request flows](../concepts/request-flows.md) |
| Read a failure | [Errors and limits](../components/errors-and-limits.md) |
| Validate a schema change | [Testing overview](../testing/overview.md) |
