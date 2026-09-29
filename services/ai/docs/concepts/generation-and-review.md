# Generation and review workflow

Generation can return a complete post immediately or pause an AI-generated
draft for human review. The latter uses an approval ID that the content service
stores with its `PostDraft` record.

```mermaid
sequenceDiagram
    participant C as Content service
    participant A as AI service
    participant G as Post generation graph
    participant L as LLM provider

    C->>A: GeneratePostDraft(prompt)
    A->>G: Create reviewable workflow state
    G->>L: Generate title, body, summary, and tags
    L-->>G: Generated content
    G-->>A: PENDING state and approvalId
    A-->>C: PostWorkflowState
    C->>A: ApprovePost(approvalId, optional edits)
    A->>G: Resume workflow
    G-->>A: APPROVED final content
    A-->>C: PostWorkflowState
```

A rejection marks the workflow `REJECTED`; it remains resumable. The content
service owns peer-review rules and canonical post persistence, while the AI
service owns the generated draft workflow.
