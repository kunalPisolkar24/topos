import { previewDB } from "./preview-db";
import {
  type MockChat,
  type MockChatMessage,
  type MockDraft,
  type MockPost,
  type MockTag,
  type MockUser,
  type MockUserProfile,
  generatePostContent,
  generateTags,
  toUserResponse,
} from "@/mocks/data";

const pic = (seed: string, width = 1200, height = 630) =>
  `https://picsum.photos/seed/${seed}/${width}/${height}`;

const avatar = (seed: string) => `https://picsum.photos/seed/${seed}/200/200`;

const slugify = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const nowIso = () => new Date().toISOString();

async function getNextPostId(): Promise<number> {
  const next = (await previewDB.getMeta("nextPostId")) as number | undefined;
  const id = next ?? 100;
  await previewDB.setMeta("nextPostId", id + 1);
  return id;
}

async function getNextDraftId(): Promise<number> {
  const next = (await previewDB.getMeta("nextDraftId")) as number | undefined;
  const id = next ?? 100;
  await previewDB.setMeta("nextDraftId", id + 1);
  return id;
}

async function getNextApprovalId(): Promise<number> {
  const next = (await previewDB.getMeta("nextApprovalId")) as number | undefined;
  const id = next ?? 200;
  await previewDB.setMeta("nextApprovalId", id + 1);
  return id;
}

async function getNextChatId(): Promise<number> {
  const next = (await previewDB.getMeta("nextChatId")) as number | undefined;
  const id = next ?? 100;
  await previewDB.setMeta("nextChatId", id + 1);
  return id;
}

async function getNextChatMessageId(): Promise<number> {
  const next = (await previewDB.getMeta("nextChatMessageId")) as number | undefined;
  const id = next ?? 1000;
  await previewDB.setMeta("nextChatMessageId", id + 1);
  return id;
}

const sortNewestFirst = <T extends { createdAt: string }>(items: T[]) =>
  [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

const paginate = <T>(items: T[], page: number, limit: number) => {
  const start = (page - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    totalPages: Math.max(1, Math.ceil(items.length / limit)),
    currentPage: page,
    total: items.length,
  };
};

function getUserById(users: MockUser[], id: string): MockUser {
  const user = users.find((u) => u.id === id);
  if (!user) throw new Error(`Mock user ${id} not found`);
  return user;
}

function getTagById(tags: MockTag[], id: string): MockTag {
  const tag = tags.find((t) => t.id === id);
  if (!tag) throw new Error(`Mock tag ${id} not found`);
  return tag;
}

function toTagResponse(tag: MockTag) {
  return { __typename: "Tag", id: tag.id, name: tag.name };
}

function toAuthorPreview(user: MockUser) {
  return {
    __typename: "User",
    id: user.id,
    username: user.username,
    name: user.name,
    avatarUrl: user.avatarUrl,
  };
}

export async function previewAuthenticate(email: string): Promise<{
  token: string;
  user: ReturnType<typeof toUserResponse>;
}> {
  const normalizedEmail = email.trim().toLowerCase();
  const users = await previewDB.getAll<MockUser>("users");
  let user = users.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (!user) {
    const username = normalizedEmail.split("@")[0]?.replace(/[^a-z0-9_]/gi, "") || "previewuser";
    const id = `preview-user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    user = {
      id,
      username: username.slice(0, 20),
      email: normalizedEmail,
      name: username.charAt(0).toUpperCase() + username.slice(1),
      bio: "Preview user — local demo account.",
      avatarUrl: avatar(username),
      bannerUrl: pic(`${username}-banner`, 1600, 400),
      createdAt: nowIso(),
    };
    await previewDB.put("users", user);
  }
  return {
    token: `preview-${user.id}`,
    user: toUserResponse(user),
  };
}

export async function previewGetUserFromToken(token: string | null): Promise<MockUser | null> {
  if (!token || !token.startsWith("preview-")) return null;
  const userId = token.replace("preview-", "");
  const user = await previewDB.get<MockUser>("users", userId);
  return user ?? null;
}

export async function previewUpdateProfile(
  userId: string,
  input: { name?: string | null; bio?: string | null; avatarUrl?: string | null; bannerUrl?: string | null },
): Promise<ReturnType<typeof toUserResponse>> {
  const user = await previewDB.get<MockUser>("users", userId);
  if (!user) throw new Error("User not found");
  if (input.name !== undefined && input.name !== null) user.name = input.name;
  if (input.bio !== undefined && input.bio !== null) user.bio = input.bio;
  if (input.avatarUrl !== undefined && input.avatarUrl !== null) user.avatarUrl = input.avatarUrl;
  if (input.bannerUrl !== undefined && input.bannerUrl !== null) user.bannerUrl = input.bannerUrl;
  await previewDB.put("users", user);
  return toUserResponse(user);
}

export async function previewListPosts(page = 1, limit = 6) {
  const posts = await previewDB.getAll<MockPost>("posts");
  const users = await previewDB.getAll<MockUser>("users");
  const tags = await previewDB.getAll<MockTag>("tags");
  const sorted = sortNewestFirst(posts);
  const { items, totalPages, currentPage, total } = paginate(sorted, page, limit);
  const toCard = (post: MockPost) => {
    const author = getUserById(users, post.authorId);
    return {
      __typename: "Post",
      id: post.id,
      title: post.title,
      body: post.body,
      imageUrl: post.imageUrl,
      createdAt: post.createdAt,
      likedByMe: post.likedByMe,
      savedByMe: post.savedByMe,
      author: toAuthorPreview(author),
      tags: post.tagIds.map((id) => toTagResponse(getTagById(tags, id))),
    };
  };
  return {
    __typename: "PaginatedPosts",
    posts: items.map(toCard),
    totalPages,
    currentPage,
    totalPosts: total,
  };
}

export async function previewListMyPosts(authorId: string, page = 1, limit = 6) {
  const posts = await previewDB.getAll<MockPost>("posts");
  const users = await previewDB.getAll<MockUser>("users");
  const tags = await previewDB.getAll<MockTag>("tags");
  const filtered = posts.filter((p) => p.authorId === authorId);
  const sorted = sortNewestFirst(filtered);
  const { items, totalPages, currentPage, total } = paginate(sorted, page, limit);
  const toCard = (post: MockPost) => {
    const author = getUserById(users, post.authorId);
    return {
      __typename: "Post",
      id: post.id,
      title: post.title,
      body: post.body,
      imageUrl: post.imageUrl,
      createdAt: post.createdAt,
      likedByMe: post.likedByMe,
      savedByMe: post.savedByMe,
      author: toAuthorPreview(author),
      tags: post.tagIds.map((id) => toTagResponse(getTagById(tags, id))),
    };
  };
  return {
    __typename: "PaginatedPosts",
    posts: items.map(toCard),
    totalPages,
    currentPage,
    totalPosts: total,
  };
}

export async function previewListPostsByTag(tag: string, page = 1, limit = 6) {
  const posts = await previewDB.getAll<MockPost>("posts");
  const users = await previewDB.getAll<MockUser>("users");
  const tags = await previewDB.getAll<MockTag>("tags");
  const filtered = posts.filter((p) => p.tagIds.some((id) => getTagById(tags, id).name === tag));
  const sorted = sortNewestFirst(filtered);
  const { items, totalPages, currentPage, total } = paginate(sorted, page, limit);
  const toCard = (post: MockPost) => {
    const author = getUserById(users, post.authorId);
    return {
      __typename: "Post",
      id: post.id,
      title: post.title,
      body: post.body,
      imageUrl: post.imageUrl,
      createdAt: post.createdAt,
      likedByMe: post.likedByMe,
      savedByMe: post.savedByMe,
      author: toAuthorPreview(author),
      tags: post.tagIds.map((id) => toTagResponse(getTagById(tags, id))),
    };
  };
  return {
    __typename: "PaginatedPosts",
    posts: items.map(toCard),
    totalPages,
    currentPage,
    totalPosts: total,
  };
}

export async function previewGetPost(id: string) {
  const post = await previewDB.get<MockPost>("posts", id);
  if (!post) return null;
  const users = await previewDB.getAll<MockUser>("users");
  const tags = await previewDB.getAll<MockTag>("tags");
  const posts = await previewDB.getAll<MockPost>("posts");
  const author = getUserById(users, post.authorId);
  const related = posts
    .filter((p) => p.id !== post.id && p.tagIds.some((t) => post.tagIds.includes(t)))
    .sort((a, b) => {
      const overlap =
        b.tagIds.filter((t) => post.tagIds.includes(t)).length -
        a.tagIds.filter((t) => post.tagIds.includes(t)).length;
      if (overlap !== 0) return overlap;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, 5)
    .map((p) => {
      const rauthor = getUserById(users, p.authorId);
      return {
        __typename: "Post",
        id: p.id,
        title: p.title,
        body: p.body,
        imageUrl: p.imageUrl,
        createdAt: p.createdAt,
        likedByMe: p.likedByMe,
        savedByMe: p.savedByMe,
        author: toAuthorPreview(rauthor),
        tags: p.tagIds.map((tid) => toTagResponse(getTagById(tags, tid))),
      };
    });

  return {
    __typename: "Post",
    id: post.id,
    title: post.title,
    body: post.body,
    slug: post.slug,
    imageUrl: post.imageUrl,
    summary: post.summary,
    summaryStatus: post.summaryStatus,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    likedByMe: post.likedByMe,
    savedByMe: post.savedByMe,
    author: {
      ...toAuthorPreview(author),
      email: author.email,
      bio: author.bio,
    },
    approvedById: post.approvedById ?? null,
    tags: post.tagIds.map((tid) => toTagResponse(getTagById(tags, tid))),
    related,
  };
}

export async function previewListTags(query: string, limit = 6) {
  const tags = await previewDB.getAll<MockTag>("tags");
  const needle = query.toLowerCase();
  return tags
    .filter((t) => t.name.toLowerCase().includes(needle))
    .slice(0, limit)
    .map(toTagResponse);
}

export async function previewSearchPosts(query: string, page = 1, limit = 6) {
  const posts = await previewDB.getAll<MockPost>("posts");
  const users = await previewDB.getAll<MockUser>("users");
  const tags = await previewDB.getAll<MockTag>("tags");
  const needle = query.toLowerCase();
  const hits = sortNewestFirst(
    posts.filter((post) => {
      const author = getUserById(users, post.authorId);
      const haystack = [
        post.title,
        post.body,
        post.summary,
        author.username,
        author.name,
        ...post.tagIds.map((id) => getTagById(tags, id).name),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    }),
  );
  const { items, total } = paginate(hits, page, limit);
  const toCard = (post: MockPost) => {
    const author = getUserById(users, post.authorId);
    return {
      __typename: "Post",
      id: post.id,
      title: post.title,
      body: post.body,
      imageUrl: post.imageUrl,
      createdAt: post.createdAt,
      likedByMe: post.likedByMe,
      savedByMe: post.savedByMe,
      author: toAuthorPreview(author),
      tags: post.tagIds.map((id) => toTagResponse(getTagById(tags, id))),
    };
  };
  return {
    __typename: "SearchResult",
    hits: items.map(toCard),
    total,
  };
}

export async function previewCreatePost(
  authorId: string,
  input: { title: string; body: string; summary?: string | null; tags?: string[] | null; imageUrl?: string | null },
) {
  const tags = await previewDB.getAll<MockTag>("tags");
  const now = nowIso();
  const id = `post-${await getNextPostId()}`;
  const tagIds = await ensureTags(input.tags, tags);
  const post: MockPost = {
    id,
    title: input.title,
    body: input.body,
    slug: slugify(input.title),
    imageUrl: input.imageUrl ?? null,
    summary: input.summary ?? "",
    summaryStatus: input.summary ? "COMPLETED" : "PENDING",
    authorId,
    tagIds,
    likedByMe: false,
    savedByMe: false,
    createdAt: now,
    updatedAt: now,
  };
  await previewDB.put("posts", post);
  return { __typename: "Post", id: post.id };
}

async function ensureTags(names: string[] | null | undefined, existingTags: MockTag[]): Promise<string[]> {
  const ids: string[] = [];
  for (const name of names ?? []) {
    const existing = existingTags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      ids.push(existing.id);
    } else {
      const tag: MockTag = { id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name };
      await previewDB.put("tags", tag);
      existingTags.push(tag);
      ids.push(tag.id);
    }
  }
  return ids;
}

export async function previewUpdatePost(
  id: string,
  input: { title?: string | null; body?: string | null; summary?: string | null; tags?: string[] | null; imageUrl?: string | null },
) {
  const post = await previewDB.get<MockPost>("posts", id);
  if (!post) throw new Error(`Mock post ${id} not found`);
  const tags = await previewDB.getAll<MockTag>("tags");
  if (input.title !== undefined && input.title !== null) {
    post.title = input.title;
    post.slug = slugify(input.title);
  }
  if (input.body !== undefined && input.body !== null) post.body = input.body;
  if (input.summary !== undefined && input.summary !== null) post.summary = input.summary;
  if (input.imageUrl !== undefined && input.imageUrl !== null) post.imageUrl = input.imageUrl;
  if (input.tags !== undefined && input.tags !== null) {
    post.tagIds = await ensureTags(input.tags, tags);
  }
  post.updatedAt = nowIso();
  await previewDB.put("posts", post);
  const updated = await previewGetPost(id);
  if (!updated) throw new Error("Failed to load updated post");
  return updated;
}

export async function previewDeletePost(id: string): Promise<boolean> {
  await previewDB.delete("posts", id);
  return true;
}

export async function previewToggleLike(postId: string): Promise<boolean> {
  const post = await previewDB.get<MockPost>("posts", postId);
  if (!post) throw new Error(`Mock post ${postId} not found`);
  post.likedByMe = !post.likedByMe;
  await previewDB.put("posts", post);
  return post.likedByMe;
}

export async function previewToggleSave(postId: string): Promise<boolean> {
  const post = await previewDB.get<MockPost>("posts", postId);
  if (!post) throw new Error(`Mock post ${postId} not found`);
  post.savedByMe = !post.savedByMe;
  await previewDB.put("posts", post);
  return post.savedByMe;
}

// Feed-personalization weights, mirroring services/ai/src/config.py so
// preview ranks like production: view 1.0, like 3.0, save 5.0, with
// feedback from the Surprise surface halved.
export const PREVIEW_VIEW_WEIGHT = 1.0;
export const PREVIEW_LIKE_WEIGHT = 3.0;
export const PREVIEW_SAVE_WEIGHT = 5.0;
export const PREVIEW_SURPRISE_FEEDBACK_MULTIPLIER = 0.5;
const PREVIEW_TAG_WEIGHT_CAP = 10.0;
const PREVIEW_MAX_PROFILE_TAGS = 64;
const PREVIEW_SEEN_POSTS_CAP = 200;

export type PreviewSignal = "view" | "like" | "save";

const baseSignalWeight = (signal: PreviewSignal): number => {
  if (signal === "like") return PREVIEW_LIKE_WEIGHT;
  if (signal === "save") return PREVIEW_SAVE_WEIGHT;
  return PREVIEW_VIEW_WEIGHT;
};

// Records a signal into the viewer's taste profile. Views dedupe per
// user+post (mirrors the backend 24h seen-key); unlikes/unsaves never
// reach here — like production, toggle-off publishes nothing.
export async function previewRecordSignal(
  userId: string,
  postId: string,
  signal: PreviewSignal,
  sourceMode?: string | null,
): Promise<void> {
  const post = await previewDB.get<MockPost>("posts", postId);
  if (!post) throw new Error(`Mock post ${postId} not found`);
  const existing =
    (await previewDB.get<MockUserProfile>("profiles", userId)) ?? null;
  if (signal === "view" && existing?.seenPostIds.includes(postId)) return;
  const weight =
    baseSignalWeight(signal) *
    (sourceMode === "SURPRISE" ? PREVIEW_SURPRISE_FEEDBACK_MULTIPLIER : 1);
  const tagWeights: Record<string, number> = { ...(existing?.tagWeights ?? {}) };
  for (const tagId of post.tagIds) {
    tagWeights[tagId] = Math.min((tagWeights[tagId] ?? 0) + weight, PREVIEW_TAG_WEIGHT_CAP);
  }
  while (Object.keys(tagWeights).length > PREVIEW_MAX_PROFILE_TAGS) {
    let lightest: string | null = null;
    for (const [tagId, w] of Object.entries(tagWeights)) {
      if (lightest === null || (w as number) < (tagWeights[lightest] as number)) lightest = tagId;
    }
    if (lightest === null) break;
    delete tagWeights[lightest];
  }
  const seenPostIds = [...(existing?.seenPostIds ?? []).filter((id) => id !== postId), postId].slice(
    -PREVIEW_SEEN_POSTS_CAP,
  );
  await previewDB.put("profiles", {
    id: userId,
    tagWeights,
    seenPostIds,
    totalWeight: (existing?.totalWeight ?? 0) + weight,
  });
}

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const shuffled = [...items];
  const rand = mulberry32(seed);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = shuffled[i] as T;
    shuffled[i] = shuffled[j] as T;
    shuffled[j] = tmp;
  }
  return shuffled;
}

export async function previewListRecommendedPosts(
  viewerId: string,
  page = 1,
  limit = 6,
  mode?: string | null,
  seed?: number | null,
) {
  const posts = await previewDB.getAll<MockPost>("posts");
  const users = await previewDB.getAll<MockUser>("users");
  const tags = await previewDB.getAll<MockTag>("tags");
  const profile = await previewDB.get<MockUserProfile>("profiles", viewerId);
  const tagNameById = new Map(tags.map((t) => [t.id, t.name]));
  const candidates = posts.filter(
    (p) => p.authorId !== viewerId && !(profile?.seenPostIds.includes(p.id) ?? false),
  );
  const weights = profile?.tagWeights ?? {};
  const hasProfile = Object.keys(weights).length > 0;
  const scoreOf = (post: MockPost) =>
    post.tagIds.reduce((sum, tagId) => sum + (weights[tagId] ?? 0), 0);
  let ranked: MockPost[];
  if (mode === "SURPRISE") {
    ranked = seededShuffle(candidates, seed ?? 0);
  } else if (hasProfile) {
    ranked = [...candidates].sort((a, b) => {
      const diff = scoreOf(b) - scoreOf(a);
      if (diff !== 0) return diff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  } else {
    ranked = sortNewestFirst(candidates);
  }
  const { items, totalPages, currentPage, total } = paginate(ranked, page, limit);
  const toCard = (post: MockPost) => {
    const author = getUserById(users, post.authorId);
    return {
      __typename: "Post",
      id: post.id,
      title: post.title,
      body: post.body,
      imageUrl: post.imageUrl,
      createdAt: post.createdAt,
      likedByMe: post.likedByMe,
      savedByMe: post.savedByMe,
      author: toAuthorPreview(author),
      tags: post.tagIds.map((id) => toTagResponse(getTagById(tags, id))),
    };
  };
  const reasons =
    mode === "SURPRISE" || !hasProfile
      ? []
      : items.flatMap((post) => {
          let topTag: string | null = null;
          for (const tagId of post.tagIds) {
            if (
              (weights[tagId] ?? 0) > 0 &&
              (topTag === null || (weights[tagId] as number) > (weights[topTag] as number))
            ) {
              topTag = tagId;
            }
          }
          if (topTag === null) return [];
          return [{ postId: post.id, reason: `Because you engage with ${tagNameById.get(topTag) ?? "these"} posts` }];
        });
  return {
    __typename: "PaginatedPosts",
    posts: items.map(toCard),
    totalPages,
    currentPage,
    totalPosts: total,
    reasons,
  };
}

const toPreviewDraftResponse = (d: MockDraft) => ({
  __typename: "PostDraft" as const,
  id: d.id,
  approvalId: d.approvalId,
  prompt: d.prompt,
  title: d.title,
  body: d.body,
  summary: d.summary,
  tags: d.tags,
  imageUrl: d.imageUrl ?? null,
  status: d.status,
  authorId: d.authorId,
  postId: d.postId,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
  reviewedById: d.reviewedById ?? null,
  reviewedAt: d.reviewedAt ?? null,
  rejectionNote: d.rejectionNote ?? null,
});

const toDraftAuthorResponse = (user: MockUser | null | undefined) =>
  user
    ? {
        __typename: "User" as const,
        id: user.id,
        username: user.username,
        name: user.name,
        avatarUrl: user.avatarUrl,
      }
    : null;

// withDraftAuthor attaches the federated author the real gateway resolves,
// so preview renders the same identity surfaces as every other env.
async function withDraftAuthor<T extends { authorId: string }>(draft: T) {
  const user = await previewDB.get<MockUser>("users", draft.authorId);
  return { ...draft, author: toDraftAuthorResponse(user) };
}

export async function previewGetUserById(id: string) {
  const user = await previewDB.get<MockUser>("users", id);
  return user ? toUserResponse(user) : null;
}

export async function previewListPostDrafts(page = 1, limit = 6, viewerId?: string) {
  const drafts = await previewDB.getAll<MockDraft>("drafts");
  // Community queue mirrors prod: pending only, never the viewer's own.
  const visible = drafts.filter(
    (d) => d.status === "PENDING" && (viewerId === undefined || d.authorId !== viewerId),
  );
  const sorted = sortNewestFirst(visible);
  const { items, totalPages, currentPage, total } = paginate(sorted, page, limit);
  return {
    __typename: "PaginatedPostDrafts" as const,
    drafts: await Promise.all(items.map((item) => withDraftAuthor(toPreviewDraftResponse(item)))),
    totalPages,
    currentPage,
    totalDrafts: total,
  };
}

export async function previewListMyPostDrafts(authorId: string, page = 1, limit = 6) {
  const drafts = await previewDB.getAll<MockDraft>("drafts");
  const mine = drafts.filter((d) => d.authorId === authorId);
  const sorted = sortNewestFirst(mine);
  const { items, totalPages, currentPage, total } = paginate(sorted, page, limit);
  return {
    __typename: "PaginatedPostDrafts" as const,
    drafts: await Promise.all(items.map((item) => withDraftAuthor(toPreviewDraftResponse(item)))),
    totalPages,
    currentPage,
    totalDrafts: total,
  };
}

export async function previewCreatePostDraft(authorId: string, prompt: string) {
  const generated = generatePostContent(prompt);
  const now = nowIso();
  const draft: MockDraft = {
    id: `draft-${await getNextDraftId()}`,
    approvalId: `approval-${await getNextApprovalId()}`,
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
  await previewDB.put("drafts", draft);
  return withDraftAuthor(toPreviewDraftResponse(draft));
}

export interface PreviewContentDraftInput {
  title: string;
  body: string;
  summary?: string | null;
  tags?: string[] | null;
  imageUrl?: string | null;
  postId?: string | null;
}

// Human-authored content entering review. postId null = brand-new post,
// set = revision proposal for that live post. One pending draft per
// post per author: resubmitting while one is pending updates it in place
// instead of queue-spamming. Mirrors the future backend contract.
export async function previewCreateContentDraft(authorId: string, input: PreviewContentDraftInput) {
  const now = nowIso();
  const postId = input.postId ?? null;
  if (postId) {
    const drafts = await previewDB.getAll<MockDraft>("drafts");
    const existing = drafts.find(
      (d) => d.authorId === authorId && d.postId === postId && d.status === "PENDING",
    );
    if (existing) {
      existing.title = input.title;
      existing.body = input.body;
      existing.summary = input.summary ?? "";
      existing.tags = input.tags ?? [];
      if (input.imageUrl !== undefined) existing.imageUrl = input.imageUrl;
      existing.updatedAt = now;
      await previewDB.put("drafts", existing);
      return withDraftAuthor(toPreviewDraftResponse(existing));
    }
  }
  const draft: MockDraft = {
    id: `draft-${await getNextDraftId()}`,
    approvalId: `approval-${await getNextApprovalId()}`,
    prompt: postId ? `Revision proposal for ${postId}` : input.title,
    title: input.title,
    body: input.body,
    summary: input.summary ?? "",
    tags: input.tags ?? [],
    imageUrl: input.imageUrl ?? null,
    status: "PENDING",
    authorId,
    postId,
    createdAt: now,
    updatedAt: now,
  };
  await previewDB.put("drafts", draft);
  return withDraftAuthor(toPreviewDraftResponse(draft));
}

// A rejected draft stays rejected until its author edits it; that edit
// flips it back to PENDING so it re-enters the community queue.
// Resubmit clears reviewer history so the next review is fresh.
export async function previewResubmitContentDraft(
  id: string,
  actorId: string,
  input: PreviewContentDraftInput,
) {
  const draft = await previewDB.get<MockDraft>("drafts", id);
  if (!draft) throw new Error(`Mock draft ${id} not found`);
  if (draft.authorId !== actorId) throw new Error("forbidden: only the author can resubmit");
  if (draft.status !== "REJECTED") throw new Error("only rejected drafts can be resubmitted");
  const unchanged =
    draft.title === input.title &&
    draft.body === input.body &&
    draft.summary === (input.summary ?? "") &&
    JSON.stringify(draft.tags) === JSON.stringify(input.tags ?? []) &&
    (draft.imageUrl ?? null) === (input.imageUrl ?? null);
  if (unchanged) throw new Error("no changes to resubmit");
  draft.title = input.title;
  draft.body = input.body;
  draft.summary = input.summary ?? "";
  draft.tags = input.tags ?? [];
  if (input.imageUrl !== undefined) draft.imageUrl = input.imageUrl;
  draft.status = "PENDING";
  draft.reviewedById = null;
  draft.reviewedAt = null;
  draft.rejectionNote = null;
  draft.updatedAt = nowIso();
  await previewDB.put("drafts", draft);
  return withDraftAuthor(toPreviewDraftResponse(draft));
}

export async function previewApprovePostDraft(
  id: string,
  actorId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _input?: { title?: string | null; body?: string | null; summary?: string | null; tags?: string[] | null } | null,
) {
  const draft = await previewDB.get<MockDraft>("drafts", id);
  if (!draft) throw new Error(`Mock draft ${id} not found`);
  if (draft.authorId === actorId) throw new Error("forbidden: drafts must be reviewed by another user");
  if (draft.status === "APPROVED") throw new Error("draft already reviewed");
  const now = nowIso();
  draft.status = "APPROVED";
  draft.reviewedById = actorId;
  draft.reviewedAt = now;
  draft.rejectionNote = null;
  draft.updatedAt = now;
  if (draft.postId) {
    // Revision proposal: apply to the live post.
    const live = await previewDB.get<MockPost>("posts", draft.postId);
    if (live) {
      await previewUpdatePost(draft.postId, {
        title: draft.title,
        body: draft.body,
        summary: draft.summary,
        tags: draft.tags,
        imageUrl: draft.imageUrl ?? undefined,
      });
      live.approvedById = actorId;
      await previewDB.put("posts", live);
    } else {
      const created = await previewCreatePost(draft.authorId, {
        title: draft.title,
        body: draft.body,
        summary: draft.summary,
        tags: draft.tags,
        imageUrl: draft.imageUrl ?? null,
      });
      const post = await previewDB.get<MockPost>("posts", created.id);
      if (post) {
        post.approvedById = actorId;
        await previewDB.put("posts", post);
      }
      draft.postId = created.id;
    }
  } else {
    const created = await previewCreatePost(draft.authorId, {
      title: draft.title,
      body: draft.body,
      summary: draft.summary,
      tags: draft.tags,
      imageUrl: draft.imageUrl ?? null,
    });
    const post = await previewDB.get<MockPost>("posts", created.id);
    if (post) {
      post.approvedById = actorId;
      await previewDB.put("posts", post);
    }
    draft.postId = created.id;
  }
  await previewDB.put("drafts", draft);
  return withDraftAuthor(toPreviewDraftResponse(draft));
}

export async function previewRejectPostDraft(id: string, actorId: string, reason?: string | null) {
  const draft = await previewDB.get<MockDraft>("drafts", id);
  if (!draft) throw new Error(`Mock draft ${id} not found`);
  if (draft.authorId === actorId) throw new Error("forbidden: drafts must be reviewed by another user");
  if (draft.status === "REJECTED") return withDraftAuthor(toPreviewDraftResponse(draft));
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
  await previewDB.put("drafts", draft);
  return withDraftAuthor(toPreviewDraftResponse(draft));
}

export async function previewDeletePostDraft(id: string, actorId: string) {
  const draft = await previewDB.get<MockDraft>("drafts", id);
  if (!draft) throw new Error(`Mock draft ${id} not found`);
  if (draft.authorId !== actorId) throw new Error("forbidden: only the author can withdraw");
  if (draft.status !== "PENDING" && draft.status !== "REJECTED") {
    throw new Error("only pending or rejected drafts can be withdrawn");
  }
  await previewDB.delete("drafts", id);
  return true;
}

export async function previewListReviewedDrafts(
  reviewerId: string,
  status: "APPROVED" | "REJECTED",
  page = 1,
  limit = 6,
) {
  const drafts = await previewDB.getAll<MockDraft>("drafts");
  const mine = drafts.filter((d) => d.reviewedById === reviewerId && d.status === status);
  const sorted = sortNewestFirst(mine);
  const { items, totalPages, currentPage, total } = paginate(sorted, page, limit);
  return {
    __typename: "PaginatedPostDrafts" as const,
    drafts: await Promise.all(items.map((item) => withDraftAuthor(toPreviewDraftResponse(item)))),
    totalPages,
    currentPage,
    totalDrafts: total,
  };
}

const toChatResponse = (chat: MockChat) => ({
  __typename: "Chat" as const,
  id: chat.id,
  title: chat.title,
  createdAt: chat.createdAt,
  updatedAt: chat.updatedAt,
});

const toChatMessageResponse = (message: MockChatMessage) => ({
  __typename: "ChatMessage" as const,
  id: message.id,
  chatId: message.chatId,
  role: message.role,
  content: message.content,
  citedPostIds: message.citedPostIds,
  createdAt: message.createdAt,
});

async function requireChatOwner(chatId: string, userId: string): Promise<MockChat> {
  const chat = await previewDB.get<MockChat>("chats", chatId);
  if (!chat) throw new Error(`Mock chat ${chatId} not found`);
  if (chat.userId !== userId) throw new Error("forbidden");
  return chat;
}

export async function previewCreateChat(userId: string, title?: string | null) {
  const now = nowIso();
  const trimmed = title?.trim();
  const chat: MockChat = {
    id: `chat-${await getNextChatId()}`,
    userId,
    title: trimmed ? trimmed : "New Chat",
    createdAt: now,
    updatedAt: now,
  };
  await previewDB.put("chats", chat);
  return toChatResponse(chat);
}

export async function previewListChats(userId: string, page = 1, limit = 10) {
  const chats = await previewDB.getAll<MockChat>("chats");
  const mine = chats.filter((c) => c.userId === userId);
  const sorted = sortNewestFirst(mine);
  const { items, totalPages, currentPage, total } = paginate(sorted, page, limit);
  return {
    __typename: "PaginatedChats" as const,
    chats: items.map(toChatResponse),
    totalPages,
    currentPage,
    totalChats: total,
  };
}

export async function previewGetChat(chatId: string, userId: string) {
  const chat = await previewDB.get<MockChat>("chats", chatId);
  if (!chat || chat.userId !== userId) return null;
  return toChatResponse(chat);
}

export async function previewRenameChat(chatId: string, userId: string, title: string) {
  if (!title.trim()) throw new Error("title must not be empty");
  const chat = await requireChatOwner(chatId, userId);
  chat.title = title.trim();
  chat.updatedAt = nowIso();
  await previewDB.put("chats", chat);
  return toChatResponse(chat);
}

export async function previewDeleteChat(chatId: string, userId: string) {
  await requireChatOwner(chatId, userId);
  await previewDB.delete("chats", chatId);
  return true;
}

export async function previewListChatMessages(chatId: string, userId: string, page = 1, limit = 20) {
  await requireChatOwner(chatId, userId);
  const messages = await previewDB.getAll<MockChatMessage>("messages");
  const thread = messages.filter((m) => m.chatId === chatId);
  const sorted = sortNewestFirst(thread);
  const { items, totalPages, currentPage, total } = paginate(sorted, page, limit);
  return {
    __typename: "PaginatedMessages" as const,
    messages: items.map(toChatMessageResponse),
    totalPages,
    currentPage,
    totalMessages: total,
  };
}

const CHAT_STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "what", "how", "why",
  "about", "into", "does", "are", "was", "were", "have", "has", "can", "you",
  "your", "our", "their", "they", "them", "then", "than", "when", "where",
]);

function scoreChatPost(
  post: MockPost,
  tagNames: Map<string, string>,
  words: string[],
): number {
  let score = 0;
  const title = post.title.toLowerCase();
  const body = `${post.body} ${post.summary}`.toLowerCase();
  const tags = post.tagIds.map((id) => (tagNames.get(id) ?? "").toLowerCase()).join(" ");
  for (const word of words) {
    if (title.includes(word)) score += 3;
    if (tags.includes(word)) score += 2;
    if (body.includes(word)) score += 1;
  }
  return score;
}

export async function previewAskChat(chatId: string, userId: string, query: string) {
  const chat = await requireChatOwner(chatId, userId);
  const trimmed = query.trim();
  if (!trimmed) throw new Error("query must not be empty");

  // Simulated latency so stop/cancel paths are exercisable.
  await new Promise((resolve) => setTimeout(resolve, 350 + Math.random() * 400));

  const posts = await previewDB.getAll<MockPost>("posts");
  const tags = await previewDB.getAll<MockTag>("tags");
  const tagNames = new Map(tags.map((t) => [t.id, t.name]));
  const words = trimmed
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !CHAT_STOP_WORDS.has(w));

  const ranked = posts
    .map((post) => ({ post, score: scoreChatPost(post, tagNames, words) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  let content: string;
  let citedPostIds: string[];
  if (ranked.length === 0) {
    const suggestions = [...new Set(tags.map((t) => t.name))].slice(0, 4).join(", ");
    content =
      `I couldn't find Topos posts matching "${trimmed}". ` +
      `Try asking about ${suggestions}, or browse Latest for something to read.`;
    citedPostIds = [];
  } else {
    const lines = ranked.map(({ post }) => {
      const snippet = post.summary || post.title;
      return `- ${post.title}: ${snippet}`;
    });
    content =
      `Based on ${ranked.length} Topos post${ranked.length > 1 ? "s" : ""}, here is what the platform covers:\n` +
      lines.join("\n");
    citedPostIds = ranked.map(({ post }) => post.id);
  }

  const userCreatedAt = nowIso();
  const userMessage: MockChatMessage = {
    id: `chat-msg-${await getNextChatMessageId()}`,
    chatId,
    role: "USER",
    content: trimmed,
    citedPostIds: [],
    createdAt: userCreatedAt,
  };
  await previewDB.put("messages", userMessage);

  // Strictly after the user turn so newest-first pages stay stable.
  const assistantCreatedAt = new Date(new Date(userCreatedAt).getTime() + 1).toISOString();
  const assistantMessage: MockChatMessage = {
    id: `chat-msg-${await getNextChatMessageId()}`,
    chatId,
    role: "ASSISTANT",
    content,
    citedPostIds,
    createdAt: assistantCreatedAt,
  };
  await previewDB.put("messages", assistantMessage);

  chat.updatedAt = assistantMessage.createdAt;
  await previewDB.put("chats", chat);

  return toChatMessageResponse(assistantMessage);
}

export function previewGenerateTags(title: string, body: string) {
  return generateTags(title, body);
}

export function previewGeneratePostContent(prompt: string) {
  return generatePostContent(prompt);
}
