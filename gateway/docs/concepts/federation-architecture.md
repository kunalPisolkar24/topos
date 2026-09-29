# Federation architecture

```mermaid
sequenceDiagram
    participant B as Browser
    participant F as Frontend Apollo Client
    participant G as Apollo Router
    participant U as User subgraph
    participant C as Content subgraph

    B->>F: Request screen data
    F->>G: One GraphQL operation
    G->>U: Fetch user-owned fields
    G->>C: Fetch content-owned fields
    C->>U: Resolve federated User references when required
    U-->>G: User fields
    C-->>G: Content fields
    G-->>F: Composed response
    F-->>B: Rendered screen
```

The supergraph maps `user` to `http://user-service:4001/graphql` and `content`
to `http://content-service:4002/query`. The content schema extends the user
entity by its `id` key. This permits one client operation without giving the
frontend direct subgraph URLs.
