# RPC reference

The protobuf source is the complete field-level reference:
[`proto/ai/ai_service.proto`](../../proto/ai/ai_service.proto).

| Area | RPCs | Notes |
| --- | --- | --- |
| Generation | `GenerateSummary`, `GenerateTags`, `GeneratePost` | Unary responses |
| Review workflow | `GeneratePostDraft`, `ApprovePost`, `RejectPost` | Uses `approval_id` and workflow status |
| Index and retrieval | `IndexPost`, `DeletePost`, `SearchPosts`, `RelatedPosts`, `RelatedPostsBatch` | Returns IDs; caller owns canonical hydration |
| Embeddings | `Embed` | Returns dense vector values |
| Chat | `ChatAnswer` | Server-streaming chunks; final chunks include citations/errors |
| Profiles and feed | `UpdateUserProfile`, `RecommendFeed`, `DeleteUserProfile` | Used by the personalizer worker and content feed |

## Contract rules

- Send typed timestamps for `IndexPost.created_at`; do not serialize an
  application-specific date string.
- Pass pagination limits that respect service configuration.
- Treat returned post IDs as index results; query canonical post data from the
  content service.
- Preserve `thread_id` when continuing a checkpointed conversation.
