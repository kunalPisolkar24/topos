# Local and managed topology

## Local stack

```mermaid
flowchart TB
    root[Root Makefile] --> compose[infrastructure/docker/local/compose.yml]
    compose --> user[User service Compose]
    compose --> content[Content service Compose]
    compose --> ai[AI service Compose]
    compose --> gateway[Gateway Compose]
    compose --> frontend[Frontend Compose]
```

Local Compose runs application containers alongside local databases, broker,
cache, and vector dependencies.

## Managed stack

```mermaid
flowchart LR
    apps[Production application containers] --> rds[RDS and RDS Proxy]
    apps --> cache[ElastiCache]
    apps --> docdb[DocumentDB]
    apps --> msk[MSK]
    apps --> qdrant[Qdrant service]
    apps --> sm[Secrets Manager]
    apps --> ssm[Parameter Store]
```

The production Compose file intentionally contains app containers and the
collector, not Docker copies of the managed data plane. Floci can emulate the
managed control/data-plane contracts for local verification; real AWS uses the
same service configuration shape with production endpoints and credentials.
