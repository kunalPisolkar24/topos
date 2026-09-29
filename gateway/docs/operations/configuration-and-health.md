# Gateway configuration and health

`router.yaml` defines the public API route, CORS origins, health path,
Prometheus exporter, OTLP tracing exporter, and propagated headers.

The router forwards the `Authorization` header. This is essential: sign-in is
handled by the user subgraph, while content operations need the same identity
for authorisation.

## Verify a gateway change

1. Start the relevant Compose stack.
2. Call `http://localhost:4000/health`.
3. Send a small operation to `http://localhost:4000/graphql`.
4. Confirm the frontend origin is permitted by CORS.
5. Confirm both subgraphs are reachable at the URLs in `supergraph.yaml`.

In production, gateway traces go to the configured OpenTelemetry Collector and
metrics are scraped through its `:8088` listener.
