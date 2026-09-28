# Gateway documentation

Apollo Router is the only GraphQL endpoint the frontend calls. It composes the
user and content subgraphs, applies CORS, propagates selected request headers,
and exposes telemetry.

## Start here

1. [Routing architecture](concepts/federation-architecture.md)
2. [Configuration and operations](operations/configuration-and-health.md)
3. [Platform architecture](../../docs/concepts/architecture.md)

## Endpoints

| Endpoint | Purpose |
| --- | --- |
| `:4000/graphql` | Federated GraphQL API |
| `:4000/health` | Router health path |
| `:8088` | Health/metrics listener |

Source configuration: [`router.yaml`](../router.yaml) and
[`supergraph.yaml`](../supergraph.yaml).
