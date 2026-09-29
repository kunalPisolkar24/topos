# User service architecture

```mermaid
classDiagram
    class GraphQLServer
    class UserResolvers
    class UserService
    class UserRepository
    class PrismaClient
    class RedisCache
    class PasswordUtility
    class TokenUtility

    GraphQLServer --> UserResolvers
    UserResolvers --> UserService
    UserService --> UserRepository
    UserService --> RedisCache
    UserService --> PasswordUtility
    UserService --> TokenUtility
    UserRepository --> PrismaClient
```

Resolvers adapt the federated GraphQL schema to account operations. The service
layer applies account rules; the repository uses Prisma for PostgreSQL. Redis is
a cache, not the account source of truth. Password and JWT helpers are isolated
under `src/utils/`.
