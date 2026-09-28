# New Relic observability stack

Separate from `infrastructure/terraform` (Floci AWS mocks). This stack manages
the New Relic dashboard and golden-signal NRQL alerts over OTEL data sent by
`infrastructure/docker/prod/otel-collector`.

## Structure

- `dashboards.tf` — overview dashboard (golden signals, untouched contract).
- `dashboards_content.tf` — `Topos <env> - Content API` (HTTP/GraphQL, posts, cache, AI degradation).
- `dashboards_workers.tf` — `Topos <env> - Workers & Kafka` (consumer throughput, lag, retries, DLQ, per-worker spans).
- `dashboards_ai.tf` — `Topos <env> - AI Service` (gRPC, LLM/embeddings, Qdrant, retrieval, feed agent).
- `dashboards_user.tf` — `Topos <env> - User Service` (auth funnel, HTTP/GraphQL, Postgres pool, cache).
- `dashboards_gateway.tf` — `Topos <env> - Gateway` (federation golden signals).
- `alerts.tf` — alert policy and conditions.
- `locals.tf` — environment-scoped NRQL fragments (`span_source`, `metric_source`).
- `tests/` — mocked Terraform contracts and a read-only New Relic smoke test.

## Test

```bash
# Mocked provider contracts; no New Relic account required.
make obs-test-unit

# After applying the stack, verify the account can run NRQL and contains the
# expected dashboard. This is read-only and needs a user API key.
export NEW_RELIC_API_KEY=NRAK-...
export NEW_RELIC_ACCOUNT_ID=1234567
make obs-test-live
```

Dashboard permissions default to `PRIVATE`. Override
`dashboard_permissions` only when a broader sharing policy is explicitly
required. All dashboard and alert NRQL is scoped to `environment` through the
`deployment.environment` OTEL resource attribute.
