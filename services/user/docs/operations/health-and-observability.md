# Health and observability

How to run this service under monitoring: what each probe means, what the
metrics tell you, and how logs and traces fit together.

For the settings that control these features, see
[Configuration](../getting-started/configuration.md).

## Endpoints

| Path | Purpose | Healthy response |
| --- | --- | --- |
| `POST /graphql` | All account operations | GraphQL response |
| `GET /` | Cheap banner check | `200` — `user service running` |
| `GET /health` | **Liveness** — is the process alive? | `200 {"status":"ok","db":"ok","redis":"ok"}` |
| `GET /healthz` | Liveness, minimal variant | `200 {"status":"ok"}` |
| `GET /ready` | **Readiness** — should this instance get traffic? | `200 {"status":"ok","db":"ok","redis":"ok"}` |
| `GET /readyz` | Readiness, identical behaviour to `/ready` | as above |
| `GET /metrics` | Prometheus scrape target | `200` with Prometheus text format |

Handlers live in [`src/http/handlers.ts`](../../src/http/handlers.ts).

### Status matrix

| Condition | `/health` | `/healthz` | `/ready`, `/readyz` |
| --- | --- | --- | --- |
| Everything healthy | `200` `{status: ok, db: ok, redis: ok}` | `200` `{status: ok}` | `200` `{status: ok, db: ok, redis: ok}` |
| Redis down, Postgres up | `200` `{status: ok, db: ok, redis: unavailable}` | `200` `{status: ok}` | `200` `{status: ok, db: ok, redis: unavailable}` |
| Postgres down | `200` `{status: ok, db: unavailable, ...}` | `200` `{status: ok}` | **`503` `{status: degraded, ...}`** |
| Shutting down | **`503` `{status: shutting_down, ...}`** | **`503` `{status: shutting_down}`** | **`503` `{status: shutting_down, ...}`** |

Two design points:

- **Liveness deliberately ignores dependencies.** If `/health` went `503`
  whenever Postgres blipped, an orchestrator would restart every replica during
  a database outage — turning a partial problem into a total one. Only a dead or
  shutting-down process fails liveness.
- **Redis being down does not make the instance unready.** The service fails
  open to Postgres, so the instance is still perfectly capable of serving
  requests. See
  [Caching and resilience](../concepts/caching-and-resilience.md).

### Probe details

| Probe | Checks | Timeout |
| --- | --- | --- |
| `db` | `SELECT 1` on the pg pool | 3 s |
| `redis` | `PING` on the ioredis client | 2 s |

Both race against their timer and report `unavailable` on timeout rather than
hanging a probe. Each check is recorded in `probe_checks_total` and each ping in
`dependency_ping_duration_seconds`, so probe behaviour is itself observable.

`/ready` and `/readyz` are true aliases — identical handlers, so pick whichever
naming convention your orchestrator expects. `/health` and `/healthz` differ
slightly: `/health` pings both dependencies and reports `db` and `redis`, while
`/healthz` returns only `{"status":"ok"}` and never touches a dependency. Both
count as liveness.

```yaml
livenessProbe:
  httpGet: { path: /healthz, port: 4001 }
readinessProbe:
  httpGet: { path: /readyz, port: 4001 }
```

The Docker healthcheck in [`infra/compose.yml`](../../infra/compose.yml) uses
`/health` on a 30 s interval with 3 retries.

## Metrics

Scrape `GET /metrics`. Metric definitions are in
[`src/observability/metrics.ts`](../../src/observability/metrics.ts).

### Request level

| Metric | Type | Labels | Meaning |
| --- | --- | --- | --- |
| `http_requests_total` | counter | `method`, `route`, `status` | HTTP requests, excluding probe/metrics paths |
| `http_request_duration_seconds` | histogram | `method`, `route`, `status` | HTTP latency |
| `http_requests_in_flight` | gauge | — | Requests currently being handled |

Probes and `/metrics` are excluded from HTTP metrics so health-check traffic
does not drown out real traffic.

### GraphQL level

| Metric | Type | Labels | Meaning |
| --- | --- | --- | --- |
| `graphql_operations_total` | counter | `operation`, `status` | Per-operation success/error counts |
| `graphql_operation_duration_seconds` | histogram | `operation`, `status` | Per-operation latency |
| `graphql_errors_total` | counter | `operation`, `code` | Failures by stable error code |

`operation` is restricted to the six known names plus `anonymous`/`unknown`, so
label cardinality stays bounded regardless of what clients send.

### Datastore level

| Metric | Type | Labels | Meaning |
| --- | --- | --- | --- |
| `db_query_duration_seconds` | histogram | `operation`, `status` | Repository query latency (`create`, `findById`, `findAll`, …) |
| `db_pool_connections` | gauge | `node`, `state` | Pool size: `total`, `idle`, `waiting` |
| `cache_operations_total` | counter | `operation`, `result` | Cache reads: `hit`, `miss`, `read_error`, `write_error` |
| `cache_invalidations_total` | counter | `operation`, `result` | `key` or `lists` sweeps, `ok` or `error` |
| `redis_connected` | gauge | — | `1` connected, `0` not (or no client configured) |
| `dependency_up` | gauge | `dep` | `db` / `redis` reachability from the last ping |
| `dependency_ping_duration_seconds` | histogram | `dep` | Probe latency |
| `ratelimit_decisions_total` | counter | `policy`, `decision`, `mode` | Quota verdicts: `signup`/`signin`/`mutations`/`reads` × `allowed`/`rejected` × `redis`/`memory` |
| `ratelimit_breaker_state` | gauge | — | `0` redis authoritative, `1` memory fallback, `2` probing |
| `ratelimit_auth_in_flight` | gauge | — | Signup/signin calls currently holding a bcrypt slot |

### Business level

| Metric | Type | Meaning |
| --- | --- | --- |
| `user_signups_total` | counter | Successful account creations |
| `user_signins_total` | counter | Successful signins |
| `user_signin_failures_total` | counter | Failed signins — the alert of interest for credential-stuffing attempts |
| `probe_checks_total` | counter | `probe` (`liveness`/`readiness`) × `result` (`ok`/`degraded`/`shutting_down`) |

### Process metrics

`prom-client`'s default metrics (CPU, heap, event-loop lag, GC) are registered
automatically unless `NODE_ENV=test`.

### Useful queries

```promql
# Cache hit ratio over the last 5 minutes
sum(rate(cache_operations_total{result="hit"}[5m]))
  / sum(rate(cache_operations_total[5m]))

# Error rate by code
sum by (code) (rate(graphql_errors_total[5m]))

# Pool saturation — waiting connections should stay near zero
db_pool_connections{state="waiting"}

# Signin failures, e.g. for an abuse alert
sum(rate(user_signin_failures_total[5m])) > 0.1

# Dependency health
dependency_up == 0
```

## Logging

[**pino**](https://github.com/pinojs/pino) JSON logs, configured in
[`src/observability/logger.ts`](../../src/observability/logger.ts):

| Property | Value |
| --- | --- |
| Level | `LOG_LEVEL` (default `info`) |
| Format | JSON with ISO-8601 timestamps |
| `service` | Always `user-service` |
| `trace_id` / `span_id` | Added when an active span exists, so logs correlate with traces |
| Redaction | `password` and `token` fields, at any depth, replaced with `[redacted]` |

### What gets logged

| Event | Level | Fields |
| --- | --- | --- |
| Server started | `info` | Listening port |
| Request completed | `info` | `method`, `path`, `status`, `durationMs`, `requestId` |
| Request completed with 5xx | `error` | Same as above |
| Domain error (expected) | `info` | `code` |
| Unhandled error on a non-GraphQL route | `error` | Stack |
| Unexpected GraphQL error | `error` | Message + stack, tagged `internal graphql error` |
| Tracing enabled/disabled | `info` | Exporter endpoint or reason |

Probe and metrics paths (`/metrics`, `/health`, `/healthz`, `/ready`, `/readyz`)
are excluded from request logging, otherwise probes would dominate the log
stream.

**`requestId` is the correlation key**: it is assigned per request by Hono's
`request-id` middleware, echoed in the request log line, and available when an
error is logged — enough to line up a user-reported failure with a stack trace.

## Tracing

OpenTelemetry traces are **off unless** `OTEL_EXPORTER_OTLP_ENDPOINT` is set, in
which case [`setupTracing()`](../../src/observability/tracing.ts) starts the
Node SDK with:

| Instrumentation | Covers |
| --- | --- |
| `HttpInstrumentation` | Inbound HTTP requests and outbound HTTP calls |
| `PgInstrumentation` | Postgres queries |
| `IORedisInstrumentation` | Redis commands |

Spans are batch-exported over OTLP HTTP to `{endpoint}/v1/traces`. Because the
endpoint is normalised (gRPC `:4317` → HTTP `:4318`), a shared collector
endpoint configured for either protocol works here.

Trace and span IDs appear on every log line emitted while a span is active, so
you can jump from a slow request log entry to its trace.

## Suggested alerts

| Alert | Condition | Why |
| --- | --- | --- |
| Instance unready | `probe_checks_total{probe="readiness",result="degraded"}` for > 1 m | Postgres is not serving |
| Dependency down | `dependency_up == 0` for > 2 m | DB or Redis outage |
| Elevated error rate | `rate(graphql_errors_total[5m])` above baseline | User-visible failures |
| Signin failure spike | `rate(user_signin_failures_total[5m])` | Credential-stuffing attempt |
| Rate limiter degraded | `ratelimit_breaker_state == 1` for > 5 m | Redis down; serving memory quotas |
| Auth rate rejections | `rate(ratelimit_decisions_total{decision="rejected"}[5m])` sustained | Flood or quotas too tight; correlate with signin failures |
| Cache degrading | `cache_operations_total{result="read_error"}` climbing | Redis failing; load shifting to Postgres |
| Pool saturation | `db_pool_connections{state="waiting"} > 0` sustained | `PG_POOL_MAX` too low or queries too slow |
| Latency | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))` | Regression in user experience |

## Checking a running instance

```bash
# from services/user/
curl -s http://localhost:4001/health | jq
curl -s http://localhost:4001/ready | jq
curl -s http://localhost:4001/metrics | grep -E '^(redis_connected|dependency_up|db_pool)'
docker compose -f infra/compose.yml --project-name topos-user-local logs -f   # or: make logs
```

## Next steps

- [Configuration](../getting-started/configuration.md) — the settings behind
  each feature here
- [Caching and resilience](../concepts/caching-and-resilience.md) — what the
  degraded states mean
- [Error handling](../components/error-handling.md) — the codes appearing in
  `graphql_errors_total`
