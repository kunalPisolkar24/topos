import { previewDB } from "../preview-db";
import {
  previewApprovePostDraft,
  previewCreateContentDraft,
  previewDeletePostDraft,
  previewListMyPostDrafts,
  previewListPostDrafts,
  previewRejectPostDraft,
  previewResubmitContentDraft,
  type PreviewContentDraftInput,
} from "../preview-store";
import type { MockPost, MockUser } from "@/mocks/data";

let counter = 0;

const buildUser = (): MockUser => {
  counter += 1;
  const id = `draft-test-user-${Date.now()}-${counter}`;
  return {
    id,
    username: `drafttester${counter}`,
    email: `drafttester${counter}@topos.dev`,
    name: `Draft Tester ${counter}`,
    bio: "Preview draft test account.",
    avatarUrl: null,
    bannerUrl: null,
    createdAt: "2025-01-01T00:00:00.000Z",
  };
};

const seedPost = async (authorId: string): Promise<MockPost> => {
  const post: MockPost = {
    id: `draft-test-post-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: "A live post",
    body: "<p>live body</p>",
    slug: "a-live-post",
    imageUrl: "https://x/cover.png",
    summary: "Live summary",
    summaryStatus: "COMPLETED",
    authorId,
    tagIds: [],
    likedByMe: false,
    savedByMe: false,
    createdAt: "2025-01-02T00:00:00.000Z",
    updatedAt: "2025-01-02T00:00:00.000Z",
  };
  await previewDB.put("posts", post);
  return post;
};

const newPostInput = (): PreviewContentDraftInput => ({
  title: "Fresh human post",
  body: "<p>human body</p>",
  summary: "Human summary",
  tags: ["Go"],
  imageUrl: "https://x/human-cover.png",
  postId: null,
});

describe("preview content drafts", () => {
  it("creates a pending new-post draft visible to others but not yet a post", async () => {
    const author = buildUser();
    const peer = buildUser();
    await previewDB.put("users", author);
    await previewDB.put("users", peer);

    const draft = await previewCreateContentDraft(author.id, newPostInput());
    expect(draft.status).toBe("PENDING");
    expect(draft.postId).toBeNull();
    expect(draft.imageUrl).toBe("https://x/human-cover.png");

    const community = await previewListPostDrafts(1, 6, peer.id);
    expect(community.drafts.map((d) => d.id)).toContain(draft.id);

    const ownView = await previewListPostDrafts(1, 6, author.id);
    expect(ownView.drafts.map((d) => d.id)).not.toContain(draft.id);

    const mine = await previewListMyPostDrafts(author.id, 1, 6);
    expect(mine.drafts.map((d) => d.id)).toContain(draft.id);
  });

  it("upserts a second revision proposal for the same post instead of duplicating", async () => {
    const author = buildUser();
    await previewDB.put("users", author);
    const post = await seedPost(author.id);

    const first = await previewCreateContentDraft(author.id, {
      ...newPostInput(),
      title: "Revision v1",
      postId: post.id,
    });
    const second = await previewCreateContentDraft(author.id, {
      ...newPostInput(),
      title: "Revision v2",
      postId: post.id,
    });

    expect(second.id).toBe(first.id);
    expect(second.title).toBe("Revision v2");
    expect(second.status).toBe("PENDING");

    const mine = await previewListMyPostDrafts(author.id, 1, 6);
    expect(
      mine.drafts.filter((d) => d.postId === post.id && d.status === "PENDING"),
    ).toHaveLength(1);
  });

  it("peer approval publishes new posts with the proposed cover", async () => {
    const author = buildUser();
    const peer = buildUser();
    await previewDB.put("users", author);
    await previewDB.put("users", peer);

    const draft = await previewCreateContentDraft(author.id, newPostInput());
    const approved = await previewApprovePostDraft(draft.id, peer.id, null);

    expect(approved.status).toBe("APPROVED");
    expect(approved.postId).not.toBeNull();
    const post = await previewDB.get<MockPost>("posts", approved.postId as string);
    expect(post?.title).toBe("Fresh human post");
    expect(post?.imageUrl).toBe("https://x/human-cover.png");
    expect(post?.authorId).toBe(author.id);
  });

  it("peer approval of a revision updates the live post in place", async () => {
    const author = buildUser();
    const peer = buildUser();
    await previewDB.put("users", author);
    await previewDB.put("users", peer);
    const post = await seedPost(author.id);

    const draft = await previewCreateContentDraft(author.id, {
      ...newPostInput(),
      title: "Revised title",
      postId: post.id,
    });
    const approved = await previewApprovePostDraft(draft.id, peer.id, null);

    expect(approved.postId).toBe(post.id);
    const updated = await previewDB.get<MockPost>("posts", post.id);
    expect(updated?.title).toBe("Revised title");
    expect(updated?.imageUrl).toBe("https://x/human-cover.png");
  });

  it("forbids self-approval and double approval", async () => {
    const author = buildUser();
    const peer = buildUser();
    await previewDB.put("users", author);
    await previewDB.put("users", peer);

    const draft = await previewCreateContentDraft(author.id, newPostInput());
    await expect(previewApprovePostDraft(draft.id, author.id, null)).rejects.toThrow(
      "forbidden",
    );
    await previewApprovePostDraft(draft.id, peer.id, null);
    await expect(previewApprovePostDraft(draft.id, peer.id, null)).rejects.toThrow();
  });

  it("rejects by peer, stays idempotent, and blocks rejecting approved drafts", async () => {
    const author = buildUser();
    const peer = buildUser();
    await previewDB.put("users", author);
    await previewDB.put("users", peer);

    const draft = await previewCreateContentDraft(author.id, newPostInput());
    await expect(previewRejectPostDraft(draft.id, author.id, "note long enough for validation")).rejects.toThrow("forbidden");

    const rejected = await previewRejectPostDraft(draft.id, peer.id, "Not ready — add concrete examples and tighten the intro, then resubmit.");
    expect(rejected.status).toBe("REJECTED");
    const again = await previewRejectPostDraft(draft.id, peer.id);
    expect(again.status).toBe("REJECTED");

    // Rejected drafts leave the community queue.
    const community = await previewListPostDrafts(1, 6, peer.id);
    expect(community.drafts.map((d) => d.id)).not.toContain(draft.id);
  });

  it("resubmits rejected drafts on edit and blocks no-change or foreign resubmits", async () => {
    const author = buildUser();
    const stranger = buildUser();
    await previewDB.put("users", author);
    await previewDB.put("users", stranger);

    const draft = await previewCreateContentDraft(author.id, newPostInput());
    await previewRejectPostDraft(draft.id, stranger.id, "Needs a stronger example — the current draft is too abstract. Provide a runnable snippet.");

    await expect(
      previewResubmitContentDraft(draft.id, stranger.id, newPostInput()),
    ).rejects.toThrow("forbidden");
    await expect(
      previewResubmitContentDraft(draft.id, author.id, newPostInput()),
    ).rejects.toThrow("no changes");

    const resubmitted = await previewResubmitContentDraft(draft.id, author.id, {
      ...newPostInput(),
      title: "Fixed title",
    });
    expect(resubmitted.status).toBe("PENDING");
    expect(resubmitted.title).toBe("Fixed title");

    const community = await previewListPostDrafts(1, 6, stranger.id);
    expect(community.drafts.map((d) => d.id)).toContain(draft.id);
  });

  it("withdraws own pending and rejected drafts but never approved ones", async () => {
    const author = buildUser();
    const stranger = buildUser();
    const peer = buildUser();
    await previewDB.put("users", author);
    await previewDB.put("users", stranger);
    await previewDB.put("users", peer);

    const pending = await previewCreateContentDraft(author.id, newPostInput());
    await expect(previewDeletePostDraft(pending.id, stranger.id)).rejects.toThrow("forbidden");
    expect(await previewDeletePostDraft(pending.id, author.id)).toBe(true);

    const rejected = await previewCreateContentDraft(author.id, newPostInput());
    await previewRejectPostDraft(rejected.id, peer.id, "Out of scope for the queue — please refine the thesis and resubmit.");
    expect(await previewDeletePostDraft(rejected.id, author.id)).toBe(true);

    const approved = await previewCreateContentDraft(author.id, newPostInput());
    await previewApprovePostDraft(approved.id, peer.id, null);
    await expect(previewDeletePostDraft(approved.id, author.id)).rejects.toThrow();
  });
});
