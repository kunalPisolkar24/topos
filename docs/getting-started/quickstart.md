# Local quick start

This path starts every application and local dependency with Docker Compose.
It is the simplest way to see the platform working.

## 1. Start the stack

From the repository root:

```bash
make local-up
```

The root [Makefile](../../Makefile) creates
`infrastructure/docker/local/.env.local` from its example if it does not
exist, then runs Compose with the local stack definition.

## 2. Open the application

Open <http://localhost:3000>. The main endpoints are:

| Endpoint | Purpose |
| --- | --- |
| <http://localhost:3000> | Frontend application |
| <http://localhost:4000/graphql> | Federated GraphQL API |
| <http://localhost:4000/health> | Gateway health endpoint |

The gateway composes the user and content subgraphs. The frontend should talk
to the gateway, not directly to a subgraph.

## 3. Watch or stop the stack

```bash
make local-logs  # stream logs
make local-ps    # list containers
make local-down  # stop containers and retain volumes
```

> [!WARNING]
> `make local-clean` removes local volumes as well as containers. It is useful
> for a clean reset, but deletes local database and broker data.

## What started?

The local Compose entry point includes the user, content, AI, gateway, and
frontend Compose definitions. Their inclusion is visible in
[`infrastructure/docker/local/compose.yml`](../../infrastructure/docker/local/compose.yml).

For a guided explanation, continue with [architecture](../concepts/architecture.md).
