const pic = (seed: string, width = 1200, height = 630) =>
  `https://picsum.photos/seed/${seed}/${width}/${height}`;

const avatar = (seed: string) => `https://picsum.photos/seed/${seed}/200/200`;

export interface MockUser {
  id: string;
  username: string;
  email: string;
  name: string;
  bio: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  createdAt: string;
}

export interface MockTag {
  id: string;
  name: string;
}

export interface MockUserProfile {
  id: string;
  tagWeights: Record<string, number>;
  seenPostIds: string[];
  totalWeight: number;
}

export interface MockPost {
  id: string;
  title: string;
  body: string;
  slug: string;
  imageUrl: string | null;
  summary: string;
  summaryStatus: "COMPLETED" | "PENDING";
  authorId: string;
  tagIds: string[];
  likedByMe: boolean;
  savedByMe: boolean;
  createdAt: string;
  updatedAt: string;
  approvedById?: string | null;
}

const buildBody = (intro: string, points: string[], outro: string) =>
  [
    `<p>${intro}</p>`,
    `<h2>Key considerations</h2>`,
    `<ul>${points.map((point) => `<li>${point}</li>`).join("")}</ul>`,
    `<p>${outro}</p>`,
  ].join("");

const users: MockUser[] = [

  {
    id: "user-1",
    username: "alexcarter",
    email: "alex@topos.dev",
    name: "Alex Carter",
    bio: "Staff engineer interested in distributed systems and developer tooling. Writing about what we learn while scaling Topos.",
    avatarUrl: avatar("alexcarter"),
    bannerUrl: pic("alexcarter-banner", 1600, 400),
    createdAt: "2024-01-10T08:00:00.000Z",
  },
  {
    id: "user-2",
    username: "marcusthorne",
    email: "marcus@topos.dev",
    name: "Marcus Thorne",
    bio: "ML infrastructure engineer. Previously at a large search company, now building retrieval systems.",
    avatarUrl: avatar("marcusthorne"),
    bannerUrl: pic("marcusthorne-banner", 1600, 400),
    createdAt: "2023-05-02T10:30:00.000Z",
  },
  {
    id: "user-3",
    username: "priyasharma",
    email: "priya@topos.dev",
    name: "Priya Sharma",
    bio: "Platform team lead. I care about boring, reliable infrastructure that lets product teams move fast.",
    avatarUrl: avatar("priyasharma"),
    bannerUrl: pic("priyasharma-banner", 1600, 400),
    createdAt: "2023-06-18T14:15:00.000Z",
  },
  {
    id: "user-4",
    username: "lucasmoreau",
    email: "lucas@topos.dev",
    name: "Lucas Moreau",
    bio: "Backend engineer with a soft spot for Go, Kafka, and systems that never lose a message.",
    avatarUrl: avatar("lucasmoreau"),
    bannerUrl: pic("lucasmoreau-banner", 1600, 400),
    createdAt: "2023-08-03T09:45:00.000Z",
  },
  {
    id: "user-5",
    username: "emilywu",
    email: "emily@topos.dev",
    name: "Emily Wu",
    bio: "Frontend architect. TypeScript, GraphQL, and making complex UIs feel simple.",
    avatarUrl: avatar("emilywu"),
    bannerUrl: pic("emilywu-banner", 1600, 400),
    createdAt: "2023-11-21T16:20:00.000Z",
  },
];

const tags: MockTag[] = [
  { id: "tag-architecture", name: "Architecture" },
  { id: "tag-distributed-systems", name: "Distributed Systems" },
  { id: "tag-go", name: "Go" },
  { id: "tag-typescript", name: "TypeScript" },
  { id: "tag-machine-learning", name: "Machine Learning" },
  { id: "tag-databases", name: "Databases" },
  { id: "tag-devops", name: "DevOps" },
  { id: "tag-security", name: "Security" },
];

const posts: MockPost[] = [
  {
    id: "post-1",
    title: "Optimizing Neural Network Throughput for Low-Latency Architectures",
    slug: "optimizing-neural-network-throughput-for-low-latency-architectures",
    body: buildBody(
      "Model quality matters, but so does the time it takes to serve a prediction. In production, a great model that cannot fit inside your latency budget is useless.",
      [
        "Kernel fusion removes launch overhead by combining element-wise operations into a single pass.",
        "INT8 quantization cuts memory bandwidth roughly fourfold with a carefully calibrated calibration set.",
        "Continuous batching keeps the GPU saturated even when requests arrive in sparse bursts.",
      ],
      "Start by profiling where time actually goes before reaching for any of these techniques; the fastest optimization is usually removing work entirely.",
    ),
    imageUrl: pic("nn-throughput"),
    summary:
      "Practical techniques for reducing inference latency: kernel fusion, quantization, and batching strategies that keep GPUs saturated.",
    summaryStatus: "COMPLETED",
    authorId: "user-2",
    approvedById: "user-2",
    tagIds: ["tag-machine-learning", "tag-architecture"],
    likedByMe: false,
    savedByMe: false,
    createdAt: "2023-10-24T09:00:00.000Z",
    updatedAt: "2023-11-02T11:00:00.000Z",
  },
  {
    id: "post-2",
    title: "Federation in Production: Lessons from Splitting a Monolith Graph",
    slug: "federation-in-production-lessons-from-splitting-a-monolith-graph",
    body: buildBody(
      "Splitting one giant GraphQL schema into federated subgraphs sounded clean on paper and chaotic in practice. Here is what we learned moving Topos to Apollo Federation.",
      [
        "Agree on entity keys early; changing a @key later forces a migration of every referencing subgraph.",
        "Keep cross-subgraph queries small; each hop between services adds real network latency.",
        "Version the router configuration like application code and review every supergraph change.",
      ],
      "Federation bought us team autonomy, but only after we invested in tooling, tests, and a disciplined review process.",
    ),
    imageUrl: pic("federation-split"),
    summary:
      "A field report on moving a monolith GraphQL schema to Apollo Federation, including key choices, migration traps, and operational lessons.",
    summaryStatus: "COMPLETED",
    authorId: "user-3",
    tagIds: ["tag-architecture", "tag-distributed-systems"],
    likedByMe: false,
    savedByMe: false,
    createdAt: "2023-11-20T13:20:00.000Z",
    updatedAt: "2023-11-28T09:10:00.000Z",
  },
  {
    id: "post-3",
    title: "Rust Ownership for Go Developers",
    slug: "rust-ownership-for-go-developers",
    body: buildBody(
      "If you come from Go, Rust feels like the same systems niche with a borrow checker standing in the doorway. Once the ownership model clicks, it stops being an obstacle.",
      [
        "Ownership answers one question: who is responsible for freeing this memory when the scope ends?",
        "References borrow values without taking ownership, which is why &T can coexist with many readers.",
        "The compiler is on your side; fighting borrow errors usually means the data flow itself needs restructuring.",
      ],
      "Go gives you safety through simplicity, Rust through a stricter compiler. Both work; they just put the discipline in different places.",
    ),
    imageUrl: pic("rust-ownership"),
    summary:
      "An introduction to Rust ownership, borrowing, and lifetimes framed around the mental models Go developers already have.",
    summaryStatus: "COMPLETED",
    authorId: "user-4",
    tagIds: ["tag-go", "tag-distributed-systems"],
    likedByMe: true,
    savedByMe: false,
    createdAt: "2023-12-05T10:05:00.000Z",
    updatedAt: "2023-12-10T16:40:00.000Z",
  },
  {
    id: "post-4",
    title: "TypeScript Generics Deep Dive: From Basics to Conditional Types",
    slug: "typescript-generics-deep-dive-from-basics-to-conditional-types",
    body: buildBody(
      "Generics are where TypeScript stops being a linter and becomes a language you can reason about. This walkthrough goes from simple type parameters to conditional types and inference.",
      [
        "A type parameter is a promise: whatever the caller supplies, you handle consistently.",
        "Conditional types act as type-level if statements and unlock mapped type magic like Partial and Pick.",
        "Infer lets you extract hidden types from other types, which is how libraries like Zod stay ergonomic.",
      ],
      "You rarely need the full toolbox, but understanding it changes how you read and design type declarations.",
    ),
    imageUrl: pic("ts-generics"),
    summary:
      "A practical walkthrough of TypeScript generics, conditional types, and inference with real-world examples.",
    summaryStatus: "COMPLETED",
    authorId: "user-5",
    tagIds: ["tag-typescript"],
    likedByMe: false,
    savedByMe: false,
    createdAt: "2024-01-15T12:00:00.000Z",
    updatedAt: "2024-01-20T08:30:00.000Z",
  },
  {
    id: "post-5",
    title: "Sharding MongoDB Without Downtime",
    slug: "sharding-mongodb-without-downtime",
    body: buildBody(
      "The collection outgrew a single replica set and we had to shard it in production with zero maintenance windows. Here is the playbook that worked for us.",
      [
        "Choose a shard key with high cardinality; a key with few distinct values turns sharding into a hot-spot generator.",
        "Backfill data before flipping traffic so the initial move is a copy, not a migration.",
        "Run canary reads against the sharded cluster while writes still hit the old topology.",
      ],
      "A boring migration is a good migration. The only surprising part was how much prep happened before a single byte moved.",
    ),
    imageUrl: pic("mongo-sharding"),
    summary:
      "How we sharded a hot MongoDB collection in production without a maintenance window, including shard key selection and canary rollout.",
    summaryStatus: "COMPLETED",
    authorId: "user-2",
    tagIds: ["tag-databases", "tag-distributed-systems"],
    likedByMe: false,
    savedByMe: false,
    createdAt: "2024-02-08T09:30:00.000Z",
    updatedAt: "2024-02-14T17:45:00.000Z",
  },
  {
    id: "post-6",
    title: "Postgres at Scale: Connection Pooling Done Right",
    slug: "postgres-at-scale-connection-pooling-done-right",
    body: buildBody(
      "Every connection to Postgres costs memory and context switches. When your app is bursting with 200 replicas, naive pooling is the first thing that falls over.",
      [
        "Pool connections at the proxy layer so app instances share a bounded set of backend connections.",
        "Tune pool size against query duration, not instance count; the math is roughly requests per second times query time.",
        "Watch for idle session pins from long transactions that silently defeat your pool.",
      ],
      "The right pool size is smaller than you think. We run with far fewer connections per instance than our original estimate.",
    ),
    imageUrl: pic("postgres-pooling"),
    summary:
      "A guide to sizing and operating connection pools in front of Postgres, with the math and pitfalls we hit at scale.",
    summaryStatus: "COMPLETED",
    authorId: "user-3",
    tagIds: ["tag-databases", "tag-devops"],
    likedByMe: false,
    savedByMe: false,
    createdAt: "2024-03-12T14:50:00.000Z",
    updatedAt: "2024-03-18T10:15:00.000Z",
  },
  {
    id: "post-7",
    title: "Zero-Trust Networking for Microservices",
    slug: "zero-trust-networking-for-microservices",
    body: buildBody(
      "Trusting the network because it is inside your VPC is a comfortable lie. Zero-trust treats every request as potentially hostile, and it is more practical than it sounds.",
      [
        "Mutual TLS between services replaces network boundaries with cryptographic identity.",
        "Short-lived certificates plus automatic rotation mean a stolen credential expires on its own.",
        "Fine-grained policies at the proxy let you express which service may call which endpoint, not just which port.",
      ],
      "Start with the highest-value paths and expand gradually; zero-trust is a journey, not a flag flip.",
    ),
    imageUrl: pic("zero-trust"),
    summary:
      "An overview of zero-trust networking: mutual TLS, short-lived certificates, and proxy-enforced service policies.",
    summaryStatus: "COMPLETED",
    authorId: "user-4",
    tagIds: ["tag-security", "tag-devops"],
    likedByMe: false,
    savedByMe: false,
    createdAt: "2024-04-01T08:00:00.000Z",
    updatedAt: "2024-04-06T12:25:00.000Z",
  },
  {
    id: "post-8",
    title: "Building a Vector Search Pipeline with Dense and Sparse Embeddings",
    slug: "building-a-vector-search-pipeline-with-dense-and-sparse-embeddings",
    body: buildBody(
      "Keyword search finds exact terms but misses meaning; dense vectors capture meaning but miss exact terms. Hybrid search gets both by combining the two signals.",
      [
        "Dense embeddings capture semantic similarity but can struggle with rare or domain-specific terminology.",
        "Sparse vectors behave like learned BM25 and preserve precise term matching.",
        "Fusion at the ranker level, not the retrieval level, gives you the best of both worlds.",
      ],
      "We index every post into Qdrant as both dense and sparse vectors, then fuse scores at query time. The lift in relevance was immediate.",
    ),
    imageUrl: pic("vector-pipeline"),
    summary:
      "How we built hybrid dense-plus-sparse vector search for Topos posts, from embedding generation to score fusion.",
    summaryStatus: "PENDING",
    authorId: "user-5",
    tagIds: ["tag-machine-learning", "tag-databases"],
    likedByMe: false,
    savedByMe: false,
    createdAt: "2024-05-19T11:10:00.000Z",
    updatedAt: "2024-05-19T11:10:00.000Z",
  },
  {
    id: "post-9",
    title: "Tuning the Go Garbage Collector for Low Latency",
    slug: "tuning-the-go-garbage-collector-for-low-latency",
    body: buildBody(
      "Go's GC is a background friend until a latency spike shows up on your p99 chart. Understanding GOGC and memory limits turns it back into a dialable knob.",
      [
        "GOGC sets the heap growth target between GC cycles; lower values mean shorter, more frequent pauses.",
        "GOMEMLIMIT lets you cap the heap and trade throughput for consistent latency.",
        "Allocating less is the real fix: pool objects and reuse buffers instead of tuning knobs forever.",
      ],
      "We cut p99 GC pause from 40ms to under 2ms by reducing allocation churn and setting a sane memory limit.",
    ),
    imageUrl: pic("go-gc"),
    summary:
      "Tuning Go garbage collection for latency-sensitive services using GOGC, GOMEMLIMIT, and allocation discipline.",
    summaryStatus: "COMPLETED",
    authorId: "user-2",
    tagIds: ["tag-go", "tag-machine-learning"],
    likedByMe: false,
    savedByMe: false,
    createdAt: "2024-06-23T15:35:00.000Z",
    updatedAt: "2024-06-30T09:05:00.000Z",
  },
  {
    id: "post-10",
    title: "GraphQL Caching Strategies with Apollo",
    slug: "graphql-caching-strategies-with-apollo",
    body: buildBody(
      "GraphQL clients cache responses, but only if you tell them how. Apollo's normalized cache is powerful and forgiving, which is exactly why it needs care.",
      [
        "Normalization keys on __typename and id, so the same object is cached once across all queries.",
        "Cache policies per field control staleness, from cache-first for hot data to network-only for fresh reads.",
        "Evict and garbage-collect after mutations, or stale lists will haunt your UI.",
      ],
      "The cache is a client-side database; design its policies the way you would design indexes, deliberately.",
    ),
    imageUrl: pic("apollo-caching"),
    summary:
      "Practical Apollo Client caching: normalized cache behavior, field policies, and keeping lists fresh after mutations.",
    summaryStatus: "COMPLETED",
    authorId: "user-3",
    tagIds: ["tag-typescript", "tag-architecture"],
    likedByMe: false,
    savedByMe: false,
    createdAt: "2024-07-30T10:45:00.000Z",
    updatedAt: "2024-08-04T14:20:00.000Z",
  },
  {
    id: "post-11",
    title: "Kafka Consumer Design Patterns for Reliable Event Processing",
    slug: "kafka-consumer-design-patterns-for-reliable-event-processing",
    body: buildBody(
      "Kafka gives you at-least-once delivery and a partition model that punishes naive consumers. These patterns keep processing reliable without over-engineering.",
      [
        "Design for reprocessing: your consumer should treat every message as if it might arrive twice.",
        "Store consumer offsets only after side effects commit, or you will lose events on crash.",
        "Keep partition keys stable so related events land in order and the same consumer.",
      ],
      "Combine this with a DLQ and replay tooling, and Kafka becomes boring in the best way possible.",
    ),
    imageUrl: pic("kafka-patterns"),
    summary:
      "Reliable Kafka consumption patterns: idempotency, offset management, partition keys, and DLQ-based replay.",
    summaryStatus: "COMPLETED",
    authorId: "user-4",
    tagIds: ["tag-distributed-systems", "tag-devops"],
    likedByMe: false,
    savedByMe: false,
    createdAt: "2024-08-14T09:25:00.000Z",
    updatedAt: "2024-08-19T11:50:00.000Z",
  },
  {
    id: "post-12",
    title: "Securing JWTs in SPAs: Storage and Refresh Strategies",
    slug: "securing-jwts-in-spas-storage-and-refresh-strategies",
    body: buildBody(
      "Where you store a token matters more than how you sign it. LocalStorage is convenient and XSS-readable; the alternatives trade convenience for safety.",
      [
        "HttpOnly cookies keep tokens out of JavaScript's reach but add CSRF considerations.",
        "Short-lived access tokens with rotating refresh tokens limit the blast radius of theft.",
        "Sliding sessions based on active use give a good compromise between security and UX.",
      ],
      "There is no perfect answer, only a threat model you can defend. Pick the trade-off your app can actually enforce.",
    ),
    imageUrl: pic("jwt-spas"),
    summary:
      "Token storage, refresh rotation, and session strategies for single-page apps, mapped to the threat model each one defends against.",
    summaryStatus: "COMPLETED",
    authorId: "user-5",
    tagIds: ["tag-security", "tag-typescript"],
    likedByMe: false,
    savedByMe: false,
    createdAt: "2024-09-05T13:15:00.000Z",
    updatedAt: "2024-09-10T10:40:00.000Z",
  },
  {
    id: "post-13",
    title: "How We Cut p95 Latency by 60% Without Changing the Architecture",
    slug: "how-we-cut-p95-latency-by-60-without-changing-the-architecture",
    body: buildBody(
      "No new services, no rewrite, no exotic infrastructure. We found 60% of p95 latency hiding in three ordinary places and fixed all of them.",
      [
        "Removing a serialized dependency between two calls turned a waterfall into a fan-out.",
        "Caching hot reads at the edge of the service cut the most expensive query path entirely.",
        "Right-sizing connection pools stopped queueing under burst traffic.",
      ],
      "Profile first. The architectural rewrite we never did would have taken a year and bought us less than these three fixes.",
    ),
    imageUrl: pic("p95-latency"),
    summary:
      "Three unglamorous fixes that cut p95 latency by 60%: dependency removal, edge caching, and connection pool sizing.",
    summaryStatus: "COMPLETED",
    authorId: "user-2",
    tagIds: ["tag-devops", "tag-architecture"],
    likedByMe: true,
    savedByMe: true,
    createdAt: "2024-10-11T08:55:00.000Z",
    updatedAt: "2024-10-15T16:30:00.000Z",
  },
  {
    id: "post-14",
    title: "Fine-Tuning Embedding Models for Domain-Specific Search",
    slug: "fine-tuning-embedding-models-for-domain-specific-search",
    body: buildBody(
      "Off-the-shelf embeddings are great at general similarity and mediocre at your domain. Fine-tuning on a modest set of curated pairs closes most of that gap.",
      [
        "Curate hard negatives: pairs that look similar but are not, so the model learns what to reject.",
        "Contrastive training with in-batch negatives is cheap and effective for retrieval.",
        "Evaluate on the real ranking task, not on embedding distance, because distance is a proxy that lies.",
      ],
      "With a few hundred curated pairs and one training run we measurably improved search relevance for technical content.",
    ),
    imageUrl: pic("embedding-finetune"),
    summary:
      "How to fine-tune embedding models for domain search: hard negatives, contrastive training, and task-level evaluation.",
    summaryStatus: "COMPLETED",
    authorId: "user-3",
    tagIds: ["tag-machine-learning"],
    likedByMe: false,
    savedByMe: false,
    createdAt: "2024-11-22T12:40:00.000Z",
    updatedAt: "2024-11-27T09:00:00.000Z",
  },
  {
    id: "post-15",
    title: "Designing Idempotent APIs for Distributed Systems",
    slug: "designing-idempotent-apis-for-distributed-systems",
    body: buildBody(
      "Retries are how distributed systems heal, and retries require idempotency. An API that cannot be safely retried is an API that will eventually duplicate work.",
      [
        "Accept a client-generated idempotency key for mutating operations and dedupe on it.",
        "Return the stored response for a replayed key instead of executing the operation again.",
        "Design natural keys: a create-by-name endpoint can be idempotent by uniqueness alone.",
      ],
      "Idempotency keys are a small contract with outsized reliability returns once partial failures become routine.",
    ),
    imageUrl: pic("idempotent-apis"),
    summary:
      "Patterns for idempotent APIs: client keys, stored responses, and natural keys that make retries safe.",
    summaryStatus: "COMPLETED",
    authorId: "user-4",
    tagIds: ["tag-distributed-systems", "tag-go"],
    likedByMe: false,
    savedByMe: false,
    createdAt: "2025-01-08T10:20:00.000Z",
    updatedAt: "2025-01-12T15:05:00.000Z",
  },
  {
    id: "post-16",
    title: "Database Migrations Without Fear: A Zero-Downtime Playbook",
    slug: "database-migrations-without-fear-a-zero-downtime-playbook",
    body: buildBody(
      "Schema changes used to mean maintenance windows. With expand-and-contract migrations, they mean nothing at all to your users.",
      [
        "Expand first: add the new column or table while old code still runs against the old shape.",
        "Dual-write during the transition so both schema versions stay in sync.",
        "Contract last: backfill, verify, then drop the old structure in a later release.",
      ],
      "The rule is simple: never change schema and code in the same deploy, and every migration becomes reversible.",
    ),
    imageUrl: pic("db-migrations"),
    summary:
      "A zero-downtime migration playbook using expand-and-contract: dual writes, backfills, and safe rollouts.",
    summaryStatus: "COMPLETED",
    authorId: "user-5",
    tagIds: ["tag-databases", "tag-devops"],
    likedByMe: false,
    savedByMe: true,
    createdAt: "2025-02-17T09:40:00.000Z",
    updatedAt: "2025-02-20T13:30:00.000Z",
  },
];

let nextPostId = 100;
let signedInUser: MockUser | null = null;

const getUser = (id: string) => {
  const user = users.find((u) => u.id === id);
  if (!user) throw new Error(`Mock user ${id} not found`);
  return user;
};

const getTag = (id: string) => {
  const tag = tags.find((t) => t.id === id);
  if (!tag) throw new Error(`Mock tag ${id} not found`);
  return tag;
};

const sortNewestFirst = <T extends { createdAt: string }>(items: T[]) =>
  [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

const paginate = <T>(items: T[], page: number, limit: number) => {
  const start = (page - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    totalPages: Math.max(1, Math.ceil(items.length / limit)),
    currentPage: page,
    total: items.length,
  };
};

const slugify = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const titleCase = (value: string) =>
  value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));

const nowIso = () => new Date().toISOString();

const toTagResponse = (tag: MockTag) => ({
  __typename: "Tag",
  id: tag.id,
  name: tag.name,
});

const toAuthorPreview = (user: MockUser) => ({
  __typename: "User",
  id: user.id,
  username: user.username,
  name: user.name,
  avatarUrl: user.avatarUrl,
});

export const toUserResponse = (user: MockUser) => ({
  __typename: "User",
  id: user.id,
  username: user.username,
  email: user.email,
  name: user.name,
  bio: user.bio,
  avatarUrl: user.avatarUrl,
  bannerUrl: user.bannerUrl,
  createdAt: user.createdAt,
});

export const toPostCardResponse = (post: MockPost) => ({
  __typename: "Post",
  id: post.id,
  title: post.title,
  body: post.body,
  imageUrl: post.imageUrl,
  createdAt: post.createdAt,
  likedByMe: post.likedByMe,
  savedByMe: post.savedByMe,
  author: toAuthorPreview(getUser(post.authorId)),
  tags: post.tagIds.map(getTag).map(toTagResponse),
});

export const toPostDetailResponse = (post: MockPost) => {
  const author = getUser(post.authorId);
  const related = posts
    .filter((p) => p.id !== post.id && p.tagIds.some((t) => post.tagIds.includes(t)))
    .sort((a, b) => {
      const overlap =
        b.tagIds.filter((t) => post.tagIds.includes(t)).length -
        a.tagIds.filter((t) => post.tagIds.includes(t)).length;
      if (overlap !== 0) return overlap;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, 5);

  return {
    ...toPostCardResponse(post),
    slug: post.slug,
    summary: post.summary,
    summaryStatus: post.summaryStatus,
    updatedAt: post.updatedAt,
    author: {
      ...toAuthorPreview(author),
      email: author.email,
      bio: author.bio,
    },
    approvedById: post.approvedById ?? null,
    related: related.map(toPostCardResponse),
  };
};

const toPaginatedPostsResponse = (items: MockPost[], page: number, limit: number) => {
  const { items: pageItems, totalPages, currentPage, total } = paginate(items, page, limit);
  return {
    __typename: "PaginatedPosts",
    posts: pageItems.map(toPostCardResponse),
    totalPages,
    currentPage,
    totalPosts: total,
  };
};

export const listPosts = (page = 1, limit = 6) =>
  toPaginatedPostsResponse(sortNewestFirst(posts), page, limit);

export const listPostsByTag = (tag: string, page = 1, limit = 6) =>
  toPaginatedPostsResponse(
    sortNewestFirst(posts.filter((post) => post.tagIds.some((id) => getTag(id).name === tag))),
    page,
    limit,
  );

export const searchPosts = (query: string, page = 1, limit = 6) => {
  const needle = query.toLowerCase();
  const hits = sortNewestFirst(
    posts.filter((post) => {
      const author = getUser(post.authorId);
      const haystack = [
        post.title,
        post.body,
        post.summary,
        author.username,
        author.name,
        ...post.tagIds.map((id) => getTag(id).name),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    }),
  );
  const { items: pageItems, total } = paginate(hits, page, limit);
  return {
    __typename: "SearchResult",
    hits: pageItems.map(toPostCardResponse),
    total,
  };
};

export const getPost = (id: string) => {
  const post = posts.find((p) => p.id === id);
  return post ? toPostDetailResponse(post) : null;
};

export const listTags = (query: string, limit = 6) => {
  const needle = query.toLowerCase();
  return tags
    .filter((tag) => tag.name.toLowerCase().includes(needle))
    .slice(0, limit)
    .map(toTagResponse);
};

export const getSignedInUser = () => signedInUser;

export const getUserById = (id: string) => {
  const user = users.find((u) => u.id === id);
  return user ? toUserResponse(user) : null;
};

export const authenticate = () => {
  const user = signedInUser ?? users[0];
  signedInUser = user;
  return {
    __typename: "AuthPayload",
    token: "mock-token",
    user: toUserResponse(user),
  };
};

export const updateProfile = (input: {
  username?: string | null;
  name?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
}) => {
  const user = signedInUser ?? users[0];
  if (input.username !== undefined && input.username !== null) user.username = input.username;
  if (input.name !== undefined && input.name !== null) user.name = input.name;
  if (input.bio !== undefined && input.bio !== null) user.bio = input.bio;
  if (input.avatarUrl !== undefined && input.avatarUrl !== null) user.avatarUrl = input.avatarUrl;
  if (input.bannerUrl !== undefined && input.bannerUrl !== null) user.bannerUrl = input.bannerUrl;
  return toUserResponse(user);
};

export const createPost = (input: {
  title: string;
  body: string;
  summary?: string | null;
  tags?: string[] | null;
  imageUrl?: string | null;
}) => {
  if (!signedInUser) throw new Error("Not authenticated");
  const now = nowIso();
  const post: MockPost = {
    id: `post-${nextPostId++}`,
    title: input.title,
    body: input.body,
    slug: slugify(input.title),
    imageUrl: input.imageUrl ?? null,
    summary: input.summary ?? "",
    summaryStatus: input.summary ? "COMPLETED" : "PENDING",
    authorId: signedInUser.id,
    tagIds: resolveTagIds(input.tags),
    likedByMe: false,
    savedByMe: false,
    createdAt: now,
    updatedAt: now,
  };
  posts.push(post);
  return { __typename: "Post", id: post.id };
};

export const updatePost = (id: string, input: {
  title?: string | null;
  body?: string | null;
  summary?: string | null;
  tags?: string[] | null;
  imageUrl?: string | null;
}) => {
  const post = posts.find((p) => p.id === id);
  if (!post) throw new Error(`Mock post ${id} not found`);
  if (input.title !== undefined && input.title !== null) {
    post.title = input.title;
    post.slug = slugify(input.title);
  }
  if (input.body !== undefined && input.body !== null) post.body = input.body;
  if (input.summary !== undefined && input.summary !== null) post.summary = input.summary;
  if (input.imageUrl !== undefined && input.imageUrl !== null) post.imageUrl = input.imageUrl;
  if (input.tags !== undefined && input.tags !== null) post.tagIds = resolveTagIds(input.tags);
  post.updatedAt = nowIso();
  return toPostDetailResponse(post);
};

export const deletePost = (id: string) => {
  const index = posts.findIndex((p) => p.id === id);
  if (index === -1) throw new Error(`Mock post ${id} not found`);
  posts.splice(index, 1);
  return true;
};

export const togglePostLike = (postId: string) => {
  const post = posts.find((p) => p.id === postId);
  if (!post) throw new Error(`Mock post ${postId} not found`);
  post.likedByMe = !post.likedByMe;
  return post.likedByMe;
};

export const togglePostSave = (postId: string) => {
  const post = posts.find((p) => p.id === postId);
  if (!post) throw new Error(`Mock post ${postId} not found`);
  post.savedByMe = !post.savedByMe;
  return post.savedByMe;
};

export const recordPostView = () => true;

const resolveTagIds = (names?: string[] | null) =>
  (names ?? []).map((name) => {
    const existing = tags.find((tag) => tag.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;
    const tag: MockTag = { id: `tag-${nextPostId}-${tags.length}`, name };
    tags.push(tag);
    return tag.id;
  });

const TAG_KEYWORDS: Array<[keyword: string, tagName: string]> = [
  ["go", "Go"],
  ["rust", "Go"],
  ["typescript", "TypeScript"],
  ["graphql", "TypeScript"],
  ["mongodb", "Databases"],
  ["postgres", "Databases"],
  ["sql", "Databases"],
  ["database", "Databases"],
  ["vector", "Machine Learning"],
  ["neural", "Machine Learning"],
  ["embedding", "Machine Learning"],
  ["model", "Machine Learning"],
  ["kubernetes", "DevOps"],
  ["docker", "DevOps"],
  ["latency", "DevOps"],
  ["jwt", "Security"],
  ["auth", "Security"],
  ["security", "Security"],
  ["kafka", "Distributed Systems"],
  ["microservice", "Distributed Systems"],
  ["event", "Distributed Systems"],
  ["federation", "Architecture"],
  ["cache", "Architecture"],
];

export const generateTags = (title: string, body: string) => {
  const haystack = `${title} ${body}`.toLowerCase();
  const matches = TAG_KEYWORDS.filter(([keyword]) => haystack.includes(keyword)).map(
    ([, tagName]) => tagName,
  );
  const unique = [...new Set(matches)];
  return unique.length > 0 ? unique.slice(0, 4) : ["Architecture", "Distributed Systems", "Go"];
};

export const generatePostContent = (prompt: string) => {
  const titleWords = prompt.trim().split(/\s+/).slice(0, 10).join(" ");
  const title = titleCase(titleWords) || "Untitled Draft";
  return {
    __typename: "GeneratedPost",
    title,
    body: buildBody(
      `This draft was generated from your prompt: "${prompt.trim()}". It provides a starting point you can edit into a full post.`,
      [
        "Start with the concrete problem your readers face before introducing your approach.",
        "Include a real example with numbers; abstract advice is hard to evaluate.",
        "End with a short section on what you would do differently next time.",
      ],
      "Use this as scaffolding. The best posts come from your own experience layered on top of a solid outline.",
    ),
    summary: `A generated draft exploring ${title.toLowerCase()}, structured around the problem, an example, and lessons learned.`,
    tags: generateTags(prompt, ""),
  };
};

export interface MockDraft {
  id: string;
  approvalId: string;
  prompt: string;
  title: string;
  body: string;
  summary: string;
  tags: string[];
  // Cover proposed with the draft. Optional so older seeds stay valid;
  // preview responses normalize it to null.
  imageUrl?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  authorId: string;
  postId: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  rejectionNote?: string | null;
}

let nextDraftId = 100;
let nextApprovalId = 200;

const drafts: MockDraft[] = [
  {
    id: "draft-1",
    approvalId: "approval-1",
    prompt: "Write about connection pooling for Postgres at scale",
    title: "Postgres Connection Pooling at Scale",
    body: buildBody(
      "Pooling Postgres connections behind a proxy lets many app instances share a bounded set of backend sessions.",
      [
        "Size the pool against query duration and QPS, not replica count.",
        "Detect idle-in-transaction pins that silently exhaust the pool.",
        "Cancel slow queries early to free connections faster.",
      ],
      "With the right pool math and observability, a small fixed pool is safer than generous per-instance limits.",
    ),
    summary: "Sizing and operating a Postgres connection pool behind a shared proxy without burning connections.",
    tags: ["Databases", "DevOps"],
    status: "PENDING",
    authorId: "user-1",
    postId: null,
    createdAt: "2025-03-02T10:00:00.000Z",
    updatedAt: "2025-03-02T10:00:00.000Z",
  },
  {
    id: "draft-2",
    approvalId: "approval-2",
    prompt: "Explain hybrid dense and sparse search with Qdrant",
    title: "Hybrid Search with Dense and Sparse Vectors",
    body: buildBody(
      "Hybrid retrieval combines semantic recall from dense embeddings with lexical precision from sparse vectors.",
      [
        "Dense vectors miss rare terms; sparse vectors preserve them like learned BM25.",
        "Index both representations per post and fuse scores at the ranker.",
        "Evaluate on ranking NDCG, not embedding cosine alone.",
      ],
      "We ship both signals into Qdrant and fuse at query time for a clear relevance lift on technical content.",
    ),
    summary: "Indexing posts as dense plus sparse vectors and fusing scores at the ranker for better relevance.",
    tags: ["Machine Learning", "Databases"],
    status: "PENDING",
    authorId: "user-2",
    postId: null,
    createdAt: "2025-03-03T08:30:00.000Z",
    updatedAt: "2025-03-03T08:30:00.000Z",
  },
  {
    id: "draft-3",
    approvalId: "approval-3",
    prompt: "Design idempotent APIs with client-generated keys",
    title: "Designing Idempotent APIs for Retries",
    body: buildBody(
      "At-least-once retries are the normal path in distributed systems; APIs must tolerate safe replay.",
      [
        "Accept a client-generated idempotency key and dedupe on first write.",
        "Return the stored response for replayed keys instead of re-executing.",
        "Prefer natural keys when uniqueness already implies idempotency.",
      ],
      "A small idempotency contract pays for itself the moment partial failures become routine.",
    ),
    summary: "Client keys, stored responses, and natural keys that make mutating APIs safely retryable.",
    tags: ["Distributed Systems", "Go"],
    status: "PENDING",
    authorId: "user-3",
    postId: null,
    createdAt: "2025-03-04T09:15:00.000Z",
    updatedAt: "2025-03-04T09:15:00.000Z",
  },
  {
    id: "draft-4",
    approvalId: "approval-4",
    prompt: "Guide to rolling out zero-trust mTLS between services",
    title: "Zero-Trust mTLS Between Services",
    body: buildBody(
      "Zero-trust replaces implicit network trust with short-lived cryptographic identity per service.",
      [
        "Issue mutual TLS certificates with automatic rotation.",
        "Enforce per-endpoint policies at the proxy rather than firewall ports.",
        "Roll out incrementally starting from the highest-value paths.",
      ],
      "Treat every hop as untrusted until proven otherwise, and rotate credentials faster than they can leak.",
    ),
    summary: "Moving from VPC trust to short-lived mTLS with proxy-enforced policies.",
    tags: ["Security", "DevOps"],
    status: "APPROVED",
    authorId: "user-4",
    postId: "post-1",
    createdAt: "2025-02-28T12:00:00.000Z",
    updatedAt: "2025-03-01T14:00:00.000Z",
    reviewedById: "user-2",
    reviewedAt: "2025-03-01T14:00:00.000Z",
  },
  {
    id: "draft-5",
    approvalId: "approval-5",
    prompt: "Compare TypeScript conditional types to generics",
    title: "Conditional Types Versus Generics in TypeScript",
    body: buildBody(
      "Conditional types turn generics from placeholders into type-level programs.",
      [
        "Map types with conditionals to build utilities like Pick and ReturnType.",
        "Use infer to peel hidden types out of generic positions.",
        "Prefer simple generics unless the abstraction pays back in autocomplete.",
      ],
      "Conditional types are powerful and easy to overuse; keep them hidden behind well-named helpers.",
    ),
    summary: "How conditional types extend generics with inference and mapped-type power.",
    tags: ["TypeScript"],
    status: "REJECTED",
    authorId: "user-5",
    postId: null,
    createdAt: "2025-02-27T16:00:00.000Z",
    updatedAt: "2025-02-28T11:00:00.000Z",
    reviewedById: "user-1",
    reviewedAt: "2025-02-28T11:00:00.000Z",
    rejectionNote:
      "Needs a stronger motivating example and clearer trade-offs — the generics baseline is too brief for the audience. Add a runnable utility and resubmit.",
  },
  {
    id: "draft-6",
    approvalId: "approval-6",
    prompt: "Revision proposal for post-1",
    title: "Optimizing Neural Network Throughput for Low-Latency Architectures",
    body: buildBody(
      "Model quality matters, but so does the time it takes to serve a prediction. This revision adds a section on continuous batching trade-offs.",
      [
        "Kernel fusion removes launch overhead by combining element-wise operations into a single pass.",
        "INT8 quantization cuts memory bandwidth roughly fourfold with a carefully calibrated calibration set.",
        "Continuous batching keeps the GPU saturated even when requests arrive in sparse bursts.",
      ],
      "Start by profiling where time actually goes before reaching for any of these techniques; the fastest optimization is usually removing work entirely.",
    ),
    summary:
      "Practical techniques for reducing inference latency: kernel fusion, quantization, and batching strategies that keep GPUs saturated.",
    tags: ["Machine Learning", "Architecture"],
    imageUrl: pic("nn-throughput"),
    status: "PENDING",
    authorId: "user-2",
    postId: "post-1",
    createdAt: "2025-03-05T10:00:00.000Z",
    updatedAt: "2025-03-05T10:00:00.000Z",
  },
];

const toDraftAuthorResponse = (authorId: string) => {
  const user = users.find((candidate) => candidate.id === authorId);
  return user
    ? {
        __typename: "User" as const,
        id: user.id,
        username: user.username,
        name: user.name,
        avatarUrl: user.avatarUrl,
      }
    : null;
};

const toDraftResponse = (draft: MockDraft) => ({
  __typename: "PostDraft" as const,
  id: draft.id,
  approvalId: draft.approvalId,
  prompt: draft.prompt,
  title: draft.title,
  body: draft.body,
  summary: draft.summary,
  tags: draft.tags,
  imageUrl: draft.imageUrl ?? null,
  status: draft.status,
  author: toDraftAuthorResponse(draft.authorId),
  authorId: draft.authorId,
  postId: draft.postId,
  createdAt: draft.createdAt,
  updatedAt: draft.updatedAt,
  reviewedById: draft.reviewedById ?? null,
  reviewedAt: draft.reviewedAt ?? null,
  rejectionNote: draft.rejectionNote ?? null,
});

const toPaginatedDraftsResponse = (items: MockDraft[], page: number, limit: number) => {
  const { items: pageItems, totalPages, currentPage, total } = paginate(
    sortNewestFirst(items),
    page,
    limit,
  );
  return {
    __typename: "PaginatedPostDrafts" as const,
    drafts: pageItems.map(toDraftResponse),
    totalPages,
    currentPage,
    totalDrafts: total,
  };
};

export const createMockDraft = (overrides: Partial<MockDraft> = {}): MockDraft => {
  const now = nowIso();
  return {
    id: `draft-${nextDraftId++}`,
    approvalId: `approval-${nextApprovalId++}`,
    prompt: "Write a draft about reliable event processing",
    title: "Reliable Event Processing with Kafka",
    body: buildBody(
      "Reliable consumption starts with idempotency and offset hygiene.",
      [
        "Store offsets only after side effects commit.",
        "Design for reprocessing by making handlers idempotent.",
        "Keep partition keys stable for ordering.",
      ],
      "Combine a DLQ with replay and Kafka becomes boring in the best way.",
    ),
    summary: "Patterns that keep Kafka consumers reliable without over-engineering.",
    tags: ["Distributed Systems", "DevOps"],
    status: "PENDING",
    authorId: signedInUser?.id ?? users[0].id,
    postId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
};

export const listPostDrafts = (page = 1, limit = 6) =>
  toPaginatedDraftsResponse(drafts, page, limit);

export const listMyPostDrafts = (page = 1, limit = 6) => {
  const ownerId = signedInUser?.id ?? users[0].id;
  const mine = drafts.filter((draft) => draft.authorId === ownerId);
  return toPaginatedDraftsResponse(mine, page, limit);
};

export const getDraft = (id: string) => {
  const draft = drafts.find((d) => d.id === id);
  return draft ? toDraftResponse(draft) : null;
};

export const createPostDraft = (prompt: string) => {
  const authorId = signedInUser?.id ?? users[0].id;
  const generated = generatePostContent(prompt);
  const now = nowIso();
  const draft: MockDraft = {
    id: `draft-${nextDraftId++}`,
    approvalId: `approval-${nextApprovalId++}`,
    prompt,
    title: generated.title,
    body: generated.body,
    summary: generated.summary,
    tags: generated.tags,
    status: "PENDING",
    authorId,
    postId: null,
    createdAt: now,
    updatedAt: now,
  };
  drafts.unshift(draft);
  return toDraftResponse(draft);
};

export const approvePostDraft = (
  id: string,
  input?: { title?: string | null; body?: string | null; summary?: string | null; tags?: string[] | null } | null,
) => {
  const draft = drafts.find((d) => d.id === id);
  if (!draft) throw new Error(`Mock draft ${id} not found`);
  const actorId = signedInUser?.id ?? users[0].id;
  if (draft.authorId === actorId) throw new Error("forbidden: drafts must be reviewed by another user");
  if (draft.status === "APPROVED") throw new Error("draft already reviewed");
  if (input?.title !== undefined && input?.title !== null) draft.title = input.title;
  if (input?.body !== undefined && input?.body !== null) draft.body = input.body;
  if (input?.summary !== undefined && input?.summary !== null) draft.summary = input.summary;
  if (input?.tags !== undefined && input?.tags !== null) draft.tags = input.tags;
  const now = nowIso();
  draft.status = "APPROVED";
  draft.reviewedById = actorId;
  draft.reviewedAt = now;
  draft.rejectionNote = null;
  draft.updatedAt = now;
  if (draft.postId) {
    const live = posts.find((p) => p.id === draft.postId);
    if (live) {
      live.title = draft.title;
      live.body = draft.body;
      live.summary = draft.summary;
      live.slug = slugify(draft.title);
      live.tagIds = resolveTagIds(draft.tags);
      if (draft.imageUrl !== undefined) live.imageUrl = draft.imageUrl;
      live.updatedAt = now;
      live.approvedById = actorId;
    } else {
      const created: MockPost = {
        id: draft.postId ?? `post-${nextPostId++}`,
        title: draft.title,
        body: draft.body,
        slug: slugify(draft.title),
        imageUrl: draft.imageUrl ?? null,
        summary: draft.summary,
        summaryStatus: draft.summary ? "COMPLETED" : "PENDING",
        authorId: draft.authorId,
        tagIds: resolveTagIds(draft.tags),
        likedByMe: false,
        savedByMe: false,
        createdAt: now,
        updatedAt: now,
        approvedById: actorId,
      };
      posts.push(created);
      draft.postId = created.id;
    }
  } else {
    const created: MockPost = {
      id: `post-${nextPostId++}`,
      title: draft.title,
      body: draft.body,
      slug: slugify(draft.title),
      imageUrl: draft.imageUrl ?? null,
      summary: draft.summary,
      summaryStatus: draft.summary ? "COMPLETED" : "PENDING",
      authorId: draft.authorId,
      tagIds: resolveTagIds(draft.tags),
      likedByMe: false,
      savedByMe: false,
      createdAt: now,
      updatedAt: now,
      approvedById: actorId,
    };
    posts.push(created);
    draft.postId = created.id;
  }
  return toDraftResponse(draft);
};

export const rejectPostDraft = (id: string, reason?: string | null) => {
  const draft = drafts.find((d) => d.id === id);
  if (!draft) throw new Error(`Mock draft ${id} not found`);
  const actorId = signedInUser?.id ?? users[0].id;
  if (draft.authorId === actorId) throw new Error("forbidden: drafts must be reviewed by another user");
  if (draft.status === "REJECTED") return toDraftResponse(draft);
  if (draft.status !== "PENDING") throw new Error("approved drafts cannot be rejected");
  const trimmed = (reason ?? "").trim();
  if (trimmed.length < 10) throw new Error("Rejection note is required — tell the author why (min 10 characters)");
  if (trimmed.length > 1000) throw new Error("Rejection note is too long (max 1000 characters)");
  const now = nowIso();
  draft.status = "REJECTED";
  draft.reviewedById = actorId;
  draft.reviewedAt = now;
  draft.rejectionNote = trimmed;
  draft.updatedAt = now;
  return toDraftResponse(draft);
};

export const deletePostDraft = (id: string) => {
  const index = drafts.findIndex((d) => d.id === id);
  if (index === -1) throw new Error(`Mock draft ${id} not found`);
  drafts.splice(index, 1);
  return true;
};

export interface MockChat {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface MockChatMessage {
  id: string;
  chatId: string;
  role: "USER" | "ASSISTANT";
  content: string;
  citedPostIds: string[];
  createdAt: string;
}

const chats: MockChat[] = [
  {
    id: "chat-1",
    userId: "user-1",
    title: "Idempotency patterns",
    createdAt: "2025-03-05T10:00:00.000Z",
    updatedAt: "2025-03-05T10:12:00.000Z",
  },
  {
    id: "chat-2",
    userId: "user-1",
    title: "New Chat",
    createdAt: "2025-03-06T09:00:00.000Z",
    updatedAt: "2025-03-06T09:00:00.000Z",
  },
];

const chatMessages: MockChatMessage[] = [
  {
    id: "chat-msg-1",
    chatId: "chat-1",
    role: "USER",
    content: "How do I make retries safe for mutating APIs?",
    citedPostIds: [],
    createdAt: "2025-03-05T10:10:00.000Z",
  },
  {
    id: "chat-msg-2",
    chatId: "chat-1",
    role: "ASSISTANT",
    content:
      "Based on 1 Topos post, the reliable pattern is client-generated idempotency keys with stored responses: accept a key on mutating operations, dedupe on first write, and return the stored response on replay.",
    citedPostIds: ["post-15"],
    createdAt: "2025-03-05T10:12:00.000Z",
  },
];

export const seedUsers = users;
export const seedTags = tags;
export const seedPosts = posts;
export const seedDrafts = drafts;
export const seedChats = chats;
export const seedChatMessages = chatMessages;
