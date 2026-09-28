# Frontend application architecture

```mermaid
flowchart LR
    routes[Routes and pages] --> features[Feature controllers and components]
    features --> entities[Entity repositories]
    entities --> apollo[Apollo Client and cache]
    apollo -->|GraphQL| gateway[Gateway /graphql]
    features --> session[Session store]
    session --> storage[Browser storage]
```

The frontend groups code by application, features, entities, shared utilities,
and widgets. GraphQL documents and generated types live under `src/shared/graphql/`.
The session layer stores the authenticated identity and the API link adds the
JWT to later GraphQL requests.
