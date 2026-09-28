# Publishing and indexing flow

Saving a post and enriching it are deliberately separate steps. The author gets
a response after the canonical post is written; AI work is asynchronous.

```mermaid
sequenceDiagram
    participant B as Browser
    participant G as Gateway
    participant C as Content API
    participant M as MongoDB
    participant K as Kafka posts topic
    participant S as Summary worker
    participant I as Search worker
    participant A as AI service
    participant Q as Qdrant

    B->>G: createPost or updatePost
    G->>C: GraphQL mutation
    C->>M: Persist canonical post
    C->>K: Publish post.created or post.updated
    C-->>G: Return post with summary status
    G-->>B: Mutation response
    par Summary path
        K->>S: Consume post event
        S->>M: Read current post
        S->>A: GenerateSummary(clean body)
        S->>M: Set summary COMPLETED or FAILED
    and Index path
        K->>I: Consume post event
        I->>A: IndexPost(event data)
        A->>Q: Upsert dense and sparse index record
    end
```

The summary worker re-reads the post before acting. It skips a deleted post and
skips a summary already marked complete. An empty usable body or empty AI result
marks the summary as `FAILED`. The search worker treats an event tombstone as a
request to remove the post from the AI index.

Event payload fields and names are defined in
[`internal/domain/event.go`](../../internal/domain/event.go); worker behaviour
is implemented in `internal/worker/`.
