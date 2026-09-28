# User GraphQL API

The federated schema is [`schema.graphql`](../../schema.graphql).

| Operation | Behaviour |
| --- | --- |
| `signup(email, username, password)` | Creates an account and returns a JWT plus `User`. |
| `signin(email, password)` | Verifies credentials and returns a JWT plus `User`. |
| `me` | Returns the authenticated user or no user. |
| `user(id)` | Looks up one federated user. |
| `users(limit, cursor)` | Lists users using cursor pagination. |
| `updateProfile(...)` | Changes profile fields for the authenticated user. |

`User` is declared with the federation key `id`. Other subgraphs may extend it,
but this service owns the account identity fields.
