# User service documentation

The User service is the TypeScript GraphQL subgraph that owns accounts, profile
fields, password verification, and JWT issuance. These pages explain how it
works and how to run it, assuming no prior knowledge of the service.

## New to this service?

Start here:

1. **[Quick start](getting-started/quickstart.md)** — get the service running and
   prove it works with a few curl commands.
2. **[Architecture](concepts/architecture.md)** — see how the code is layered and
   what each class is responsible for.
3. **[Request flows](concepts/request-flows.md)** — follow one GraphQL operation
   from HTTP request to database row and back.

## Documentation by topic

### Getting started

| Document | What you'll learn | When to read |
| --- | --- | --- |
| [Quick start](getting-started/quickstart.md) | Run the service locally, with Docker or on the host | First time using the service |
| [Configuration](getting-started/configuration.md) | Every setting, its default, and where it comes from | Setting up a new environment |

### Concepts

| Document | What you'll learn | When to read |
| --- | --- | --- |
| [Architecture](concepts/architecture.md) | How the code is layered and why | Understanding the system |
| [Data model](concepts/data-model.md) | The tables, columns, indexes, and soft-delete rules | Changing or querying account data |
| [Authentication flow](concepts/authentication-flow.md) | How passwords are hashed and JWTs issued and verified | Working with auth |
| [Request flows](concepts/request-flows.md) | What happens inside each operation, step by step | Debugging an operation |
| [Caching and resilience](concepts/caching-and-resilience.md) | Redis caching, retries, timeouts, and degraded modes | Performance or reliability work |

### Components

| Document | What you'll learn | When to read |
| --- | --- | --- |
| [GraphQL API](components/graphql-api.md) | Every query and mutation, with examples | Integrating with the service |
| [Error handling](components/error-handling.md) | What each error code means and where it surfaces | Decoding a failed response |

### Operations

| Document | What you'll learn | When to read |
| --- | --- | --- |
| [Health and observability](operations/health-and-observability.md) | Probe endpoints, metrics, logs, and traces | Monitoring or debugging the service |

### Testing

| Document | What you'll learn | When to read |
| --- | --- | --- |
| [Testing overview](testing/overview.md) | How to run unit, integration, and load tests | Writing or running tests |

## Reading order by role

### New developer

1. [Quick start](getting-started/quickstart.md) — get it running
2. [Architecture](concepts/architecture.md) — understand the big picture
3. [Request flows](concepts/request-flows.md) — see a request end to end
4. [Data model](concepts/data-model.md) — learn what is stored
5. [GraphQL API](components/graphql-api.md) — learn the API

### Backend developer integrating with this service

1. [GraphQL API](components/graphql-api.md) — learn the API
2. [Authentication flow](concepts/authentication-flow.md) — understand the token
3. [Error handling](components/error-handling.md) — handle failures
4. [Testing overview](testing/overview.md) — verify your integration

### DevOps / SRE

1. [Quick start](getting-started/quickstart.md) — run it
2. [Configuration](getting-started/configuration.md) — configure it
3. [Health and observability](operations/health-and-observability.md) — set up
   probes, metrics, and alerts
4. [Caching and resilience](concepts/caching-and-resilience.md) — understand
   degraded behaviour

## Related files

- **Service README**: [`../README.md`](../README.md) — overview and command
  reference
- **Federated schema**: [`../schema.graphql`](../schema.graphql)
- **Prisma schema**: [`../prisma/schema.prisma`](../prisma/schema.prisma)
- **Environment template**: [`../.env.example`](../.env.example)
- **Compose stacks**: [`../infra/compose.yml`](../infra/compose.yml)
- **Build and run targets**: [`../Makefile`](../Makefile)
- **Project documentation**: [`../../../docs/README.md`](../../../docs/README.md)
