# GraphQL API guide

The full source of truth is [`graph/schema.graphqls`](../../graph/schema.graphqls).
The gateway exposes this subgraph as part of the combined `/graphql` API.

## Main operation groups

| Group | Queries | Mutations |
| --- | --- | --- |
| Posts and tags | `posts`, `post`, `tags`, `postsByTag` | `createPost`, `updatePost`, `deletePost`, `generateTags` |
| AI and discovery | `searchPosts`, `recommendedPosts` | `generatePostContent`, `recordPostView`, `likePost`, `savePost` |
| Chats | `chats`, `chat`, `chatMessages` | `createChat`, `renameChat`, `deleteChat`, `askChat` |
| Peer review | `postDrafts`, `myPostDrafts` | create/resubmit/approve/reject/delete draft mutations |

## Federation

`Post.author` resolves a `User` entity owned by the user subgraph. Conversely,
the content schema extends `User` with `posts`. Keep federation fields and
entity keys aligned with the user schema when changing either side.

## Pagination and result hydration

List queries use page/limit values that the service normalizes. Search and
recommendation operations receive ranked post IDs from the AI service, then
hydrate canonical post data from MongoDB. Missing or stale index IDs are dropped
rather than failing an entire query.
