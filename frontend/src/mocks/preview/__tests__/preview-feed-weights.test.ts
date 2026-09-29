import { previewDB } from "../preview-db";
import {
  previewListRecommendedPosts,
  previewRecordSignal,
} from "../preview-store";
import type { MockPost, MockTag, MockUser, MockUserProfile } from "@/mocks/data";

let counter = 0;
const uniq = () => {
  counter += 1;
  return `${Date.now()}-${counter}`;
};

const buildUser = async (): Promise<MockUser> => {
  const id = `feed-test-user-${uniq()}`;
  const user: MockUser = {
    id,
    username: `feedtester${counter}`,
    email: `${id}@topos.dev`,
    name: `Feed Tester ${counter}`,
    bio: "Preview feed test account.",
    avatarUrl: null,
    bannerUrl: null,
    createdAt: "2025-01-01T00:00:00.000Z",
  };
  await previewDB.put("users", user);
  return user;
};

const seedTag = async (name: string): Promise<MockTag> => {
  const tag: MockTag = { id: `feed-tag-${uniq()}-${name}`, name };
  await previewDB.put("tags", tag);
  return tag;
};

const seedPost = async (args: {
  authorId: string;
  tagIds: string[];
  title?: string;
  createdAt?: string;
}): Promise<MockPost> => {
  const id = `feed-test-post-${uniq()}`;
  const post: MockPost = {
    id,
    title: args.title ?? `Post ${id}`,
    body: "<p>body</p>",
    slug: id,
    imageUrl: null,
    summary: "",
    summaryStatus: "COMPLETED",
    authorId: args.authorId,
    tagIds: args.tagIds,
    likedByMe: false,
    savedByMe: false,
    createdAt: args.createdAt ?? "2025-02-01T00:00:00.000Z",
    updatedAt: "2025-02-01T00:00:00.000Z",
  };
  await previewDB.put("posts", post);
  return post;
};

const readProfile = (userId: string) => previewDB.get<MockUserProfile>("profiles", userId);

describe("preview feed weights", () => {
  it("accumulates view 1.0, like 3.0, save 5.0 into tag weights", async () => {
    const viewer = await buildUser();
    const author = await buildUser();
    const tag = await seedTag("VectorDB");
    const [p1, p2, p3] = await Promise.all([
      seedPost({ authorId: author.id, tagIds: [tag.id] }),
      seedPost({ authorId: author.id, tagIds: [tag.id] }),
      seedPost({ authorId: author.id, tagIds: [tag.id] }),
    ]);

    await previewRecordSignal(viewer.id, p1.id, "view", null);
    expect((await readProfile(viewer.id))?.tagWeights[tag.id]).toBe(1);

    await previewRecordSignal(viewer.id, p2.id, "like", null);
    expect((await readProfile(viewer.id))?.tagWeights[tag.id]).toBe(4);

    await previewRecordSignal(viewer.id, p3.id, "save", null);
    expect((await readProfile(viewer.id))?.tagWeights[tag.id]).toBe(9);
  });

  it("halves feedback from the surprise surface", async () => {
    const viewer = await buildUser();
    const author = await buildUser();
    const tag = await seedTag("SurpriseTag");
    const post = await seedPost({ authorId: author.id, tagIds: [tag.id] });

    await previewRecordSignal(viewer.id, post.id, "like", "SURPRISE");
    expect((await readProfile(viewer.id))?.tagWeights[tag.id]).toBe(1.5);
  });

  it("dedupes repeat views per user and post", async () => {
    const viewer = await buildUser();
    const author = await buildUser();
    const tag = await seedTag("DedupeTag");
    const post = await seedPost({ authorId: author.id, tagIds: [tag.id] });

    await previewRecordSignal(viewer.id, post.id, "view", null);
    await previewRecordSignal(viewer.id, post.id, "view", null);

    const profile = await readProfile(viewer.id);
    expect(profile?.tagWeights[tag.id]).toBe(1);
    expect(profile?.seenPostIds).toEqual([post.id]);
  });

  it("caps tag weights at 10 and evicts the lightest past 64 tags", async () => {
    const viewer = await buildUser();
    const author = await buildUser();
    const firstTag = await seedTag("FirstTag");
    const first = await seedPost({ authorId: author.id, tagIds: [firstTag.id] });
    await previewRecordSignal(viewer.id, first.id, "save", null);
    await previewRecordSignal(viewer.id, first.id, "save", null);

    const tagIds: string[] = [];
    for (let i = 0; i < 64; i++) {
      const tag = await seedTag(`EvictTag${i}-${uniq()}`);
      tagIds.push(tag.id);
      const post = await seedPost({ authorId: author.id, tagIds: [tag.id] });
      await previewRecordSignal(viewer.id, post.id, "view", null);
    }

    const profile = await readProfile(viewer.id);
    expect(profile?.tagWeights[firstTag.id]).toBe(10);
    expect(Object.keys(profile?.tagWeights ?? {})).toHaveLength(64);
    // FirstTag (weight 10) survives; the earliest weight-1 tag is evicted.
    expect(profile?.tagWeights[firstTag.id]).toBeDefined();
    const survivingOnes = tagIds.filter((id) => profile?.tagWeights[id] !== undefined);
    expect(survivingOnes).toHaveLength(63);
  });

  it("caps the seen list at 200, keeping the most recent", async () => {
    const viewer = await buildUser();
    const author = await buildUser();
    const tag = await seedTag("SeenTag");
    const ids: string[] = [];
    for (let i = 0; i < 201; i++) {
      const post = await seedPost({ authorId: author.id, tagIds: [tag.id] });
      ids.push(post.id);
      await previewRecordSignal(viewer.id, post.id, "view", null);
    }
    const profile = await readProfile(viewer.id);
    expect(profile?.seenPostIds).toHaveLength(200);
    expect(profile?.seenPostIds[0]).toBe(ids[1]);
    expect(profile?.seenPostIds[199]).toBe(ids[200]);
  });

  it("ranks overlapping tags first with reasons, excluding own and seen posts", async () => {
    const viewer = await buildUser();
    const author = await buildUser();
    const loved = await seedTag("LovedTopic");
    const other = await seedTag("OtherTopic");
    const matching = await seedPost({
      authorId: author.id,
      tagIds: [loved.id],
      title: "Matching post",
      createdAt: "2025-01-01T00:00:00.000Z",
    });
    await seedPost({
      authorId: author.id,
      tagIds: [other.id],
      title: "Unrelated post",
      createdAt: "2025-03-01T00:00:00.000Z",
    });
    await seedPost({
      authorId: viewer.id,
      tagIds: [loved.id],
      title: "Own post",
      createdAt: "2025-04-01T00:00:00.000Z",
    });
    const signal = await seedPost({ authorId: author.id, tagIds: [loved.id], title: "Signal post" });
    await previewRecordSignal(viewer.id, signal.id, "save", null);

    const result = await previewListRecommendedPosts(viewer.id, 1, 6, "DEFAULT", null);

    const titles = result.posts.map((p) => (p as { title: string }).title);
    expect(titles[0]).toBe("Matching post");
    expect(titles).not.toContain("Own post");
    expect(titles).not.toContain("Signal post");
    expect(result.reasons).toContainEqual({
      postId: matching.id,
      reason: "Because you engage with LovedTopic posts",
    });
  });

  it("falls back to newest-first with no reasons on a cold profile", async () => {
    const viewer = await buildUser();
    const author = await buildUser();
    const tag = await seedTag("ColdTag");
    await seedPost({ authorId: author.id, tagIds: [tag.id], title: "Older cold", createdAt: "2026-05-01T00:00:00.000Z" });
    await seedPost({ authorId: author.id, tagIds: [tag.id], title: "Newer cold", createdAt: "2026-06-01T00:00:00.000Z" });

    const result = await previewListRecommendedPosts(viewer.id, 1, 6, "DEFAULT", null);

    const titles = result.posts.map((p) => (p as { title: string }).title);
    expect(titles.slice(0, 2)).toEqual(["Newer cold", "Older cold"]);
    expect(result.reasons).toEqual([]);
  });

  it("shuffles deterministically per seed for surprise with empty reasons", async () => {
    const viewer = await buildUser();
    const author = await buildUser();
    const tag = await seedTag("ShuffleTag");
    for (let i = 0; i < 6; i++) {
      await seedPost({ authorId: author.id, tagIds: [tag.id], title: `Shuffle ${i}` });
    }

    const first = await previewListRecommendedPosts(viewer.id, 1, 6, "SURPRISE", 42);
    const second = await previewListRecommendedPosts(viewer.id, 1, 6, "SURPRISE", 42);
    const otherSeed = await previewListRecommendedPosts(viewer.id, 1, 6, "SURPRISE", 7);

    const firstIds = first.posts.map((p) => p.id);
    expect(firstIds).toEqual(second.posts.map((p) => p.id));
    expect(new Set(firstIds).size).toBe(firstIds.length);
    // With dozens of candidates, two seeds colliding on the full page is negligible.
    expect(otherSeed.posts.map((p) => p.id)).not.toEqual(firstIds);
    expect(first.reasons).toEqual([]);
  });
});
