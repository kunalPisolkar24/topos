# GraphQL API

The complete reference for the Content subgraph: every query and
mutation, what it needs, what it returns, and how it behaves under
failure.

The machine-readable source of truth is
[`graph/schema.graphqls`](../../graph/schema.graphqls) — when this page
and the schema disagree, the schema wins.

## At a glance

| | |
| --- | --- |
| Endpoint (standalone) | `POST http://localhost:4002/query` |
| Endpoint (full stack) | `POST http://localhost:4000/graphql` (gateway) |
| Transport | GraphQL over HTTP, `Content-Type: application/json` |
| Queries | **11** |
| Mutations | **18** |
| Public queries | `posts`, `post`, `tags`, `postsByTag`, `searchPosts` |
| Auth required | every mutation, plus 6 queries |
| Errors | always HTTP 200 with an `errors[]` array, *except* auth/panic |

## Conventions

Four things behave differently here than in most GraphQL APIs:

### 1. Pagination never errors

Every `page` and `limit` argument is passed through
`pagination.Normalize`, which **silently clamps**:

| Input | Effective value |
| --- | --- |
| `page` omitted, `0`, negative | `1` |
| `page > 1000` | `1000` |
| `limit` omitted, `0`, negative | `10` |
| `limit > 100` | `100` |

You can always detect clamping by comparing `currentPage` in the
response with what you sent. See
[Request flows](../concepts/request-flows.md#pagination).

### 2. Nullable return types can still error

`post(id: ID!): Post` is nullable, but a missing post produces a
`not found` **error**, not `null`. The schema's nullability reflects Go's
`*domain.Post`, not the runtime behaviour.

### 3. Errors carry no code — except rate limits

Only `message`, `path`, and `extensions.request_id` reach the client.
See [Error handling](error-handling.md).

Quota rejection is the exception: it returns
`extensions.code: "RATE_LIMITED"` with `retryAfterMs` and the tripped
`policy`, plus a `Retry-After` response header. Per-minute quotas are
120 reads, 30 mutations, 60 interactions, 30 search, 10 expensive-AI
(drafting, generation, chat) — see
[Configuration](../getting-started/configuration.md#rate-limiting).

### 4. AI-backed fields degrade rather than fail

`searchPosts`, `related`, and `recommendedPosts` return reduced results
when the AI service is unavailable. `generateTags`, `generatePostContent`,
`createPostDraft`, and `askChat` (as a real answer) do not — see
[Caching and resilience](../concepts/caching-and-resilience.md).

## Queries

| Operation | Auth | Arguments | Returns | Backend |
| --- | --- | --- | --- | --- |
| `posts` | public | `page`, `limit` | `PaginatedPosts!` | Mongo, cached 1 min |
| `post(id)` | public | `id` | `Post` | Mongo, cached 5 min |
| `tags` | public | `query`, `limit` | `[Tag!]!` | Mongo, cached 5 min |
| `postsByTag` | public | `tag!`, `page`, `limit` | `PaginatedPosts!` | Mongo, cached 1 min |
| `searchPosts` | public | `query!`, `page`, `limit` | `SearchResult!` | AI → Mongo hydrate, cached 2 min |
| `recommendedPosts` | **required** | `page`, `limit`, `mode`, `seed` | `PaginatedPosts!` | AI → Mongo hydrate, cached 30 s, recency fallback |
| `chats` | **required** | `page`, `limit` | `PaginatedChats!` | Mongo |
| `chat(id)` | **required** | `id` | `Chat` | Mongo, owner only |
| `chatMessages` | **required** | `chatId!`, `page`, `limit` | `PaginatedMessages!` | Mongo, owner only |
| `postDrafts` | **required** | `page`, `limit` | `PaginatedPostDrafts!` | Mongo — others' pending drafts |
| `myPostDrafts` | **required** | `page`, `limit` | `PaginatedPostDrafts!` | Mongo — your drafts |

### Feeds

```graphql
query Latest($page: Int, $limit: Int) {
  posts(page: $page, limit: $limit) {
    totalPosts
    totalPages
    currentPage
    posts { id title slug imageUrl createdAt author { id } }
  }
}
```

```graphql
query ByTag($tag: String!) {
  postsByTag(tag: $tag, limit: 20) {
    totalPosts
    posts { id title summary summaryStatus }
  }
}
```

`posts` is sorted `createdAt` descending and backed by the
`createdAt_desc` index; `postsByTag` uses `tags_createdAt`.

### A single post

```graphql
query One($id: ID!) {
  post(id: $id) {
    id title body slug imageUrl
    summary summaryStatus
    tags { id name }
    createdAt updatedAt
    approvedById
    related(limit: 5) { id title }
    likedByMe savedByMe
  }
}
```

| Field | Anonymous behaviour |
| --- | --- |
| `related` | Works — no personalisation needed |
| `likedByMe`, `savedByMe` | `false` (the empty state, not an error) |
| everything else | Unaffected |

A non-existent `id` returns `errors: [{message: "not found"}]`.

### Search

```graphql
query Find($q: String!) {
  searchPosts(query: $q, limit: 10) {
    total
    hits { id title slug summary tags { name } }
  }
}
```

The AI service returns ranked IDs; this service hydrates them from
MongoDB in that order. **IDs that no longer resolve are dropped
silently**, so `hits.length` can be less than `limit` and `total` can
exceed `hits.length`.

### Recommendations

```graphql
query ForMe($mode: RecommendMode, $seed: Int) {
  recommendedPosts(limit: 10, mode: $mode, seed: $seed) {
    totalPosts
    posts { id title }
    reasons { postId reason }
  }
}
```

| Aspect | Behaviour |
| --- | --- |
| Auth | **Required** — `unauthorized` without a token |
| `mode` | `DEFAULT` (default), `SURPRISE`, `FRESH`, `EXPLORER` |
| `seed` | Makes a result set reproducible; part of the cache key |
| Your own posts | Filtered out after hydration |
| AI returns empty | Recency fallback, `reasons: []`, cold-start counter increments |
| AI fails | Recency fallback, `reasons: []`, a warn log |

**An empty `reasons` array is the signal that personalisation did not
run.** `totalPosts` still reflects the AI's count and can exceed the
number of posts returned.

### Tags

```graphql
query TagList($q: String) { tags(query: $q, limit: 20) { id name } }
```

Reads the `tags` collection, not the denormalized arrays on posts.

### Chats

```graphql
query MyChats { chats(limit: 10) { totalChats chats { id title updatedAt } } }

query Thread($chatId: ID!) {
  chatMessages(chatId: $chatId, limit: 50) {
    totalMessages
    messages { id role content citedPostIds createdAt }
  }
}
```

`role` is `USER` or `ASSISTANT`. `citedPostIds` is non-empty only on
assistant messages, and each ID may resolve to `null` if the post was
deleted — see [Chat flow](../concepts/chat-flow.md).

### Draft queues

```graphql
query ReviewQueue { postDrafts(limit: 20) { totalDrafts drafts { id title authorId status } } }
query Mine       { myPostDrafts { drafts { id status rejectionNote postId } } }
```

The community queue excludes your own drafts, because you cannot review
them.

## Mutations

**All 18 require authentication.** Without a token each returns
`{"message":"unauthorized"}`.

### Posts

| Mutation | Arguments | Notes |
| --- | --- | --- |
| `createPost(input: CreatePostInput!)` | `title!`, `body!`, `summary`, `tags`, `imageUrl` | Returns immediately with `summaryStatus`; publishes `post.created` |
| `updatePost(id: ID!, input: UpdatePostInput!)` | `title`, `body`, `tags`, `imageUrl` (all optional) | Author only; title/body change resets the summary; a title change regenerates the slug |
| `deletePost(id: ID!)` | — | Author only; publishes a tombstone |

```graphql
mutation Write {
  createPost(input: {
    title: "Federation in practice"
    body: "## How the gateway composes subgraphs\n…"
    tags: ["graphql", "federation"]
  }) { id slug summaryStatus }
}
```

Validation failures come back as `validation error: …` with specifics —
see [Error handling](../components/error-handling.md#recognising-a-validation-message).

### AI generation

| Mutation | Arguments | Notes |
| --- | --- | --- |
| `generateTags(title: String!, body: String!)` | — | Returns `[String!]!`; auth checked, identity value ignored |
| `generatePostContent(prompt: String!, brief: WritingBriefInput)` | `brief` optional | Returns `GeneratedPost!`; without `brief` behaves as a single prompt |

Both require a valid token purely to stop this service becoming a public
proxy for the AI service. Neither has a fallback — an AI outage means an
error (`AI service is temporarily unavailable, please try again`).

`WritingBriefInput` carries the author's style choices into generation —
audience (`BEGINNER`, `PRACTITIONER`, `EXPERT`), tone (`PROFESSIONAL`,
`CONVERSATIONAL`, `TECHNICAL`, `STORYTELLING`, `WITTY`, `MINIMAL`),
length (`QUICK`, `STANDARD`, `DEEP_DIVE`), structure (`HOW_TO`,
`LISTICLE`, `TUTORIAL`, `COMPARISON`, `OPINION`, `CASE_STUDY`), plus
free-text `keywords` and `keyPoints`. Every field is optional; omitting
`brief` entirely keeps the legacy single-prompt behavior. Allow up to
~2 minutes for a guided draft — generation plus a possible repair pass
is two slow LLM calls, and both the gateway router and the content AI
client budget 120 s for it.

### Chats

| Mutation | Arguments | Notes |
| --- | --- | --- |
| `createChat(title: String)` | optional | Blank title becomes `New Chat` |
| `renameChat(id: ID!, title: String!)` | — | Blank title yields `internal error` (see below) |
| `deleteChat(id: ID!)` | — | Owner only |
| `askChat(chatId: ID!, query: String!)` | — | Returns the **assistant** message |

`askChat` ordering matters: the AI call runs *before* anything is
persisted, so a failure leaves no orphaned question and a retry cannot
duplicate it.

> `renameChat` with `title: ""` returns `internal error` rather than a
> validation error — the service does not wrap that check with
> `domain.ErrValidation`. The real reason is in the server log.

### Interactions

| Mutation | Returns | Notes |
| --- | --- | --- |
| `recordPostView(postId: ID!, mode: RecommendMode)` | `Boolean!` | Deduplicated within 24 h |
| `likePost(postId: ID!, mode: RecommendMode)` | `Boolean!` | Toggles; returns the new state |
| `savePost(postId: ID!, mode: RecommendMode)` | `Boolean!` | Toggles; returns the new state |

`mode` attributes the interaction to a feed for recommendation metrics.
Omitting it (opening a post directly) leaves the mode empty and the
interaction is excluded from per-feed engagement ratios.

Like and save are **toggles**: the boolean is the state *after* your
call, so calling `likePost` twice unlikes.

### Peer review

| Mutation | Arguments | Allowed for |
| --- | --- | --- |
| `createPostDraft(prompt: String!)` | ≤ 5000 chars | Any authenticated user; stamped `QUICK_PROMPT` origin |
| `createContentDraft(input: ContentDraftInput!)` | title, body, summary, tags, imageUrl, postId, `generation` | Any authenticated user; pass `generation` to record AI assistance |
| `resubmitContentDraft(id: ID!, input: ContentDraftInput!)` | must differ | Author, `REJECTED` only |
| `approvePostDraft(id: ID!, input: DraftEditsInput)` | edits optional | A **different** user |
| `rejectPostDraft(id: ID!, reason: String)` | reason strongly advised | A **different** user |
| `deletePostDraft(id: ID!)` | — | Author, `PENDING` only — this is the *withdraw* |

```graphql
mutation FileForReview {
  createContentDraft(input: {
    title: "Kafka retries, plainly"
    body: "## The budget\n…"
    tags: ["kafka"]
    imageUrl: "https://cdn.example.com/retries.png"
  }) { id approvalId status }
}
```

```graphql
mutation Review($id: ID!) {
  approvePostDraft(id: $id, input: { summary: "A tightened summary." }) {
    id status postId reviewedById
  }
}
```

Full lifecycle, including the atomic rules and race handling, is in
[Draft lifecycle](../concepts/draft-lifecycle.md).

## Types

### `Post`

```graphql
type Post @key(fields: "id") {
  id: ID!
  title: String!
  body: String!
  slug: String!
  imageUrl: String
  summary: String
  summaryStatus: SummaryStatus
  author: User!
  approvedById: ID
  tags: [Tag!]!
  createdAt: String!
  updatedAt: String!
  related(limit: Int = 5): [Post!]!
  likedByMe: Boolean!
  savedByMe: Boolean!
}
```

`createdAt` and `updatedAt` are **`String!`, not `DateTime`** — parse
them yourself. `author` is a federation reference; `approvedById` is the
peer reviewer when one exists, and `null` for directly published posts.

### Enums

| Enum | Values |
| --- | --- |
| `SummaryStatus` | `PENDING`, `COMPLETED`, `FAILED` |
| `DraftStatus` | `PENDING`, `APPROVED`, `REJECTED` |
| `DraftSource` | `QUICK_PROMPT`, `GUIDED_STUDIO` |
| `RecommendMode` | `DEFAULT`, `SURPRISE`, `FRESH`, `EXPLORER` |
| `MessageRole` | `USER`, `ASSISTANT` |

`PostDraft.generation` records the AI assistance behind a draft — `source`,
the original `prompt`, and any brief fields (`audience`, `tone`, `length`,
`structure`, `keywords`, `keyPoints`) — so reviewers can see what produced
it. It is `null` for hand-typed drafts. `createPostDraft` always stamps
`QUICK_PROMPT`; the writing studio sends `GUIDED_STUDIO` with its brief
through `ContentDraftInput.generation`.

MongoDB stores the interaction and message roles **lowercase**; only the
GraphQL layer is uppercase.

### Inputs

```graphql
input CreatePostInput { title: String!  body: String!  summary: String  tags: [String!]  imageUrl: String }
input UpdatePostInput { title: String   body: String   tags: [String!]  imageUrl: String }
input ContentDraftInput { title: String!  body: String!  summary: String  tags: [String!]  imageUrl: String  postId: ID  generation: DraftGenerationInput }
input DraftEditsInput { title: String  body: String  summary: String  tags: [String!] }
```

In `UpdatePostInput`, **omitting a field and sending `null` both mean
"leave it alone"** — `nil` is the sentinel for "no change", so `title`,
`body`, and `imageUrl` are only written when you actually send a value.

> **Quirk: you cannot clear `tags` with `updatePost`.** The resolver
> copies `input.Tags` with `append`, and appending zero elements to a nil
> slice yields nil — so both `tags: null` and `tags: []` reach the
> service as nil and leave the existing tags untouched. To remove all
> tags you must delete and recreate the post, or use a draft approval.

## Federation

The subgraph declares federation v2:

```graphql
extend schema @link(url: "https://specs.apollo.dev/federation/v2.0",
                     import: ["@key", "@shareable", "@provides", "@external"])
```

| Direction | What happens |
| --- | --- |
| Outward — `Post.author` | This subgraph returns a `User` reference (`{__typename, id}`); the gateway fetches the rest from the user subgraph |
| Inward — `User.posts` | The gateway sends `_entities` here; `entityResolver.FindPostByID` resolves the post |
| Inward — `extend type User @key(fields: "id")` | Adds `posts(page, limit)` to the user service's `User` |

`entityResolver.FindUserByID` returns **only `{ID}`** — a stub. There are
no user fields on this subgraph beyond `id`, so querying
`post { author { name } }` works only through the gateway.

> When changing `Post`'s key or `User`'s external `id`, both subgraphs
> must stay aligned. Run the gateway's composition check before merging.

## Query cost and batching

Derived per-post fields are coalesced within a single HTTP request:

| Field | Batched into | Cost for 20 posts |
| --- | --- | --- |
| `related` | `RelatedPostsBatch` | 1 AI call + 1 Mongo query |
| `likedByMe` / `savedByMe` | `States` | 1 Mongo query |
| federation `findPostByID` | `GetPost` batch | 1 Mongo query |

The coalescing window is **5 ms** and is **per request** — two separate
HTTP calls do not share batches.

## Working examples

### End-to-end: write, read, interact

```graphql
# 1. create (authenticated)
mutation {
  createPost(input: { title: "Hello", body: "World", tags: ["meta"] }) {
    id slug summaryStatus
  }
}

# 2. read it back (public)
query { post(id: "<id>") { id title summary summaryStatus related { id } } }

# 3. like it (authenticated) — returns the new state
mutation { likePost(postId: "<id>") }
```

### Handling failures

```ts
const res = await fetch("/query", { method: "POST", headers, body });
const text = await res.text();

// transport-level: a bad token produces plain text and HTTP 401,
// which JSON.parse would reject
if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);

const json = JSON.parse(text);

// GraphQL-level: HTTP 200 even on failure
if (json.errors?.length) {
  const { message } = json.errors[0];
  const requestId = json.errors[0].extensions?.request_id;

  if (message === "unauthorized") await refreshToken();
  else if (message === "not found") showMissing();
  else if (message.startsWith("validation error:")) showValidationError(message);
  else if (message.startsWith("AI service is temporarily unavailable")) showRetryLater();
  else if (json.errors[0].extensions?.code === "RATE_LIMITED") {
    const waitMs = json.errors[0].extensions.retryAfterMs ?? 1000;
    await sleep(waitMs); // then retry the same operation
  } else reportServerIssue(message, requestId);   // includes "internal error"
}
```

See [Error handling](error-handling.md) for the complete
message catalogue.

## Related

- [GraphQL schema](../../graph/schema.graphqls) — the contract
- [Authentication](../concepts/authentication.md) — how the auth matrix is enforced
- [Request flows](../concepts/request-flows.md) — what each query costs
- [Publishing flow](../concepts/publishing-flow.md) — what the mutations trigger
- [Error handling](error-handling.md) — decoding failures
