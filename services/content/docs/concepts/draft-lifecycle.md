# Draft review lifecycle

Topos supports two draft origins: an AI-generated draft from a prompt, or a
human-authored content draft. Both enter the same peer-review lifecycle.

```mermaid
stateDiagram-v2
    [*] --> PENDING: create AI or content draft
    PENDING --> APPROVED: another user approves
    PENDING --> REJECTED: another user rejects
    REJECTED --> PENDING: author resubmits
    APPROVED --> [*]: publish/create or update post
```

## Review rules

- The author cannot review their own draft.
- A reviewer may edit generated fields before approval.
- A rejection can include a reviewer note.
- A resubmission clears prior reviewer details and starts a fresh review.
- An atomic status transition ensures concurrent reviews do not publish twice.

```mermaid
sequenceDiagram
    participant A as Author
    participant C as Content API
    participant AI as AI service
    participant D as Draft store
    participant R as Reviewer
    participant P as Post store

    A->>C: createPostDraft(prompt)
    C->>AI: GeneratePostDraft
    AI-->>C: Pending draft and approvalId
    C->>D: Save PENDING draft
    R->>C: approvePostDraft(edits)
    C->>D: Atomically claim PENDING draft
    C->>AI: ApprovePost(approvalId, edits)
    AI-->>C: Approved content
    C->>P: Create or update post
    C->>D: Store APPROVED status and postId
```

`PostDraft` and its atomic repository transition are defined in
[`internal/domain/post_draft.go`](../../internal/domain/post_draft.go) and
[`internal/repository/mongo_post_draft.go`](../../internal/repository/mongo_post_draft.go).
