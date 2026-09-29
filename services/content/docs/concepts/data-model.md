# Content data model

This is a **logical** ER diagram of MongoDB documents and references. MongoDB
does not enforce these links as foreign keys; the content service applies the
rules in its services and repositories.

```mermaid
erDiagram
    USER ||--o{ POST : authors
    USER ||--o{ CHAT : owns
    USER ||--o{ POST_DRAFT : submits
    USER ||--o{ POST_DRAFT : reviews
    USER ||--o{ POST_INTERACTION : records
    POST ||--o{ POST_INTERACTION : receives
    POST ||--o| POST_DRAFT : revised_by
    CHAT ||--o{ CHAT_MESSAGE : contains
    POST }o--o{ TAG : labels

    POST {
        objectId id PK
        string authorId
        string approvedById
        string title
        string slug UK
        string summaryStatus
        datetime createdAt
    }
    TAG {
        objectId id PK
        string name UK
    }
    CHAT {
        objectId id PK
        string userId
        string title
        datetime createdAt
    }
    CHAT_MESSAGE {
        objectId id PK
        string chatId
        string role
        string content
        stringArray citedPostIds
    }
    POST_INTERACTION {
        objectId id PK
        string userId
        string postId
        string kind
        datetime createdAt
    }
    POST_DRAFT {
        objectId id PK
        string approvalId UK
        string authorId
        string reviewedById
        string postId
        string status
    }
```

## Collection facts and indexes

| Collection | Important fields | Implemented indexes |
| --- | --- | --- |
| `posts` | `authorId`, `tags`, `slug`, `createdAt` | author/date, tag/date, date descending, unique slug |
| `tags` | `name` | unique name |
| `chats` | `userId`, `createdAt` | user/date |
| `messages` | `chatId`, `createdAt` | chat/date |
| `post_interactions` | `userId`, `postId`, `kind` | unique user/post/kind and user/date |
| `post_drafts` | `approvalId`, `authorId`, `status` | unique approval ID, author/date, status/date |

Tags are stored on posts as strings for retrieval; the `tags` collection
supports tag creation and suggestion. The indexes are established at startup by
[`internal/db/mongo_indexes.go`](../../internal/db/mongo_indexes.go).

## Data invariants

- `slug` is unique.
- A like/save interaction is idempotent for the same user, post, and kind.
- `approvalId` identifies one draft workflow.
- A draft status transition is an atomic compare-and-set operation, preventing
two reviewers from approving the same draft.
