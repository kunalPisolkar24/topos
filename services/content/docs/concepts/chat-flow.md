# Chat flow and citations

Chats and messages are persisted by the content service. The AI service
produces an answer from retrieved post context; the content service stores the
answer and the IDs of posts cited by it.

```mermaid
sequenceDiagram
    participant B as Browser
    participant C as Content API
    participant M as MongoDB
    participant A as AI service
    participant Q as Qdrant

    B->>C: askChat(chatId, query)
    C->>M: Verify chat owner and load recent history
    C->>M: Store user message
    C->>A: ChatAnswer(query, history, threadId)
    A->>Q: Retrieve grounded post context
    A-->>C: Stream chunks and cited post IDs
    C->>M: Store assistant message and citations
    C-->>B: ChatMessage
```

A `Chat` belongs to a user. Each `ChatMessage` belongs to a chat and has a
`user` or `assistant` role. Only assistant messages carry `citedPostIds`.
These fields are in [`internal/domain/chat.go`](../../internal/domain/chat.go).

The GraphQL mutation returns a saved message rather than exposing the internal
gRPC stream directly. The current GraphQL API contract is
[`graph/schema.graphqls`](../../graph/schema.graphqls).
