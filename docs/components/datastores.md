# Data stores

Topos uses different storage systems because each data shape and access pattern
is different. A cache or search index is never treated as the canonical source
of a post or account.

| Store | Owner | Canonical data | Main reason |
| --- | --- | --- | --- |
| PostgreSQL | User service | Users and AI chat checkpoints | Relational account data and transactional updates |
| MongoDB | Content service | Posts, tags, drafts, chats, messages, interactions | Document-shaped content and independent collections |
| Redis | User/content services | None | Cache and graceful fail-open reads |
| Kafka | Content service | None | Durable asynchronous event delivery to workers |
| Qdrant | AI service | Search and interest-index records | Dense/sparse similarity search and recommendations |

## Reading the relationships

MongoDB records references such as `authorId`, `chatId`, and `postId`, but does
not enforce database foreign keys. The content service verifies business rules
in application code. Its detailed logical ER model and its real indexes are in
the [content data model guide](../../services/content/docs/concepts/data-model.md).

Qdrant stores a derived index of post content. Search results return post IDs;
the content service hydrates those IDs from MongoDB before returning GraphQL
`Post` objects.
