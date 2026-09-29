# Authentication flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant G as Gateway
    participant U as User service
    participant P as PostgreSQL

    B->>G: signup or signin mutation
    G->>U: Route federated user operation
    U->>P: Create account or read credentials
    U->>U: Hash/verify password and sign JWT
    U-->>G: AuthPayload(token, user)
    G-->>B: AuthPayload
    B->>G: Later request with Authorization header
    G->>U: Propagate header to subgraph
```

The router explicitly propagates `Authorization`. The content service can then
authorize content operations using the same signed identity. Keep JWT issuer,
audience, and secret configuration aligned across user and content services.
