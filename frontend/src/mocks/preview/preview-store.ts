import { previewDB } from "./preview-db";
import {
  type MockDraft,
  type MockPost,
  type MockTag,
  type MockUser,
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

export async function previewListPostDrafts(page = 1, limit = 6) {
  const drafts = await previewDB.getAll<MockDraft>("drafts");
  const sorted = sortNewestFirst(drafts);
  const { items, totalPages, currentPage, total } = paginate(sorted, page, limit);
  const toDraft = (d: MockDraft) => ({
    __typename: "PostDraft" as const,
    id: d.id,
    approvalId: d.approvalId,
    prompt: d.prompt,
    title: d.title,
    body: d.body,
    summary: d.summary,
    tags: d.tags,
    status: d.status,
    authorId: d.authorId,
    postId: d.postId,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  });
  return {
    __typename: "PaginatedPostDrafts" as const,
    drafts: items.map(toDraft),
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
  const toDraft = (d: MockDraft) => ({
    __typename: "PostDraft" as const,
    id: d.id,
    approvalId: d.approvalId,
    prompt: d.prompt,
    title: d.title,
    body: d.body,
    summary: d.summary,
    tags: d.tags,
    status: d.status,
    authorId: d.authorId,
    postId: d.postId,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  });
  return {
    __typename: "PaginatedPostDrafts" as const,
    drafts: items.map(toDraft),
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
  return {
    __typename: "PostDraft" as const,
    id: draft.id,
    approvalId: draft.approvalId,
    prompt: draft.prompt,
    title: draft.title,
    body: draft.body,
    summary: draft.summary,
    tags: draft.tags,
    status: draft.status,
    authorId: draft.authorId,
    postId: draft.postId,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
}

export async function previewApprovePostDraft(
  id: string,
  input?: { title?: string | null; body?: string | null; summary?: string | null; tags?: string[] | null } | null,
) {
  const draft = await previewDB.get<MockDraft>("drafts", id);
  if (!draft) throw new Error(`Mock draft ${id} not found`);
  if (input?.title !== undefined && input?.title !== null) draft.title = input.title;
  if (input?.body !== undefined && input?.body !== null) draft.body = input.body;
  if (input?.summary !== undefined && input?.summary !== null) draft.summary = input.summary;
  if (input?.tags !== undefined && input?.tags !== null) draft.tags = input.tags;
  draft.status = "APPROVED";
  draft.postId = draft.postId ?? `post-${await getNextPostId()}`;
  draft.updatedAt = nowIso();
  await previewDB.put("drafts", draft);
  return {
    __typename: "PostDraft" as const,
    id: draft.id,
    approvalId: draft.approvalId,
    prompt: draft.prompt,
    title: draft.title,
    body: draft.body,
    summary: draft.summary,
    tags: draft.tags,
    status: draft.status,
    authorId: draft.authorId,
    postId: draft.postId,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
}

export async function previewRejectPostDraft(id: string) {
  const draft = await previewDB.get<MockDraft>("drafts", id);
  if (!draft) throw new Error(`Mock draft ${id} not found`);
  draft.status = "REJECTED";
  draft.updatedAt = nowIso();
  await previewDB.put("drafts", draft);
  return {
    __typename: "PostDraft" as const,
    id: draft.id,
    approvalId: draft.approvalId,
    prompt: draft.prompt,
    title: draft.title,
    body: draft.body,
    summary: draft.summary,
    tags: draft.tags,
    status: draft.status,
    authorId: draft.authorId,
    postId: draft.postId,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
}

export async function previewDeletePostDraft(id: string) {
  await previewDB.delete("drafts", id);
  return true;
}

export function previewGenerateTags(title: string, body: string) {
  return generateTags(title, body);
}

export function previewGeneratePostContent(prompt: string) {
  return generatePostContent(prompt);
}
