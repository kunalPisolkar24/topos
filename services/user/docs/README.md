# User service documentation

The User service is the TypeScript GraphQL subgraph that owns accounts, profile
fields, password verification, and JWT issuance.

## Start here

1. [Quick start](getting-started/quickstart.md)
2. [Architecture](concepts/architecture.md)
3. [Account data model](concepts/data-model.md)
4. [Authentication flow](concepts/authentication-flow.md)

## By task

| Task | Read |
| --- | --- |
| Use the schema | [GraphQL API](components/graphql-api.md) |
| Configure dependencies | [Operations](operations/health-and-configuration.md) |
| Verify a change | [Testing](testing/overview.md) |

The schema source is [`schema.graphql`](../schema.graphql); the Prisma source
is [`prisma/schema.prisma`](../prisma/schema.prisma).
