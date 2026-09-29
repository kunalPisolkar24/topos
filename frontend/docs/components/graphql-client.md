# Frontend GraphQL client

The Apollo client sends requests to `VITE_GRAPHQL_URL`, normally the gateway's
`/graphql` endpoint. It adds authentication from the session store and keeps a
normalised client cache.

GraphQL operation documents are source files. Run:

```bash
npm run codegen
```

after changing operations, fragments, or a dependent GraphQL schema. The build
command runs code generation and TypeScript checking before Vite creates the
production bundle.

`VITE_` values are exposed to browser code by Vite. They must not contain
private service credentials.
