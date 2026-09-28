# User service quick start

From `services/user/`:

```bash
make up
```

This starts the service, PostgreSQL, Redis, and the migrator using the service
Compose definition. For host development, run `npm ci`, provide required
settings, then run `npm run dev`.

The GraphQL subgraph is available at `http://localhost:4001/graphql`.
