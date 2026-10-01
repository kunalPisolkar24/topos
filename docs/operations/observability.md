# Observability

Topos services expose structured logs, Prometheus metrics, and optional OpenTelemetry
traces. The gateway exposes health on `/health` and metrics on `/metrics`, both on
port `8088`; its GraphQL API listens on port `4000`, and only `4000` is published
to the host, so `otel-collector` scrapes `gateway:8088` from inside the Docker
network. See [`gateway/router.yaml`](../../gateway/router.yaml).

In the production Compose stack, `otel-collector` receives telemetry and is
configured for New Relic through environment variables. The collector
configuration lives at
[`infrastructure/docker/prod/otel-collector-config.yaml`](../../infrastructure/docker/prod/otel-collector-config.yaml).

When diagnosing a local issue, start with:

```bash
make local-ps
make local-logs
```

Then check the relevant service guide for its health and metrics endpoints.
