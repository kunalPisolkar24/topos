import { previewDB } from "../preview-db";
import {
  previewAskChat,
  previewCreateChat,
  previewDeleteChat,
  previewGetChat,
  previewListChatMessages,
  previewListChats,
  previewRenameChat,
} from "../preview-store";
import type { MockPost, MockTag, MockUser } from "@/mocks/data";

let userCounter = 0;

const buildUser = (): MockUser => {
  userCounter += 1;
  const id = `chat-test-user-${Date.now()}-${userCounter}`;
  return {
    id,
    username: `chattester${userCounter}`,
    email: `chattester${userCounter}@topos.dev`,
    name: `Chat Tester ${userCounter}`,
    bio: "Preview chat test account.",
    avatarUrl: null,
    bannerUrl: null,
    createdAt: "2025-01-01T00:00:00.000Z",
  };
};

const seedCorpus = async () => {
  const tag: MockTag = { id: `chat-test-tag-${Date.now()}`, name: "QuokkaFacts" };
  await previewDB.put("tags", tag);
  const post: MockPost = {
    id: `chat-test-post-${Date.now()}`,
    title: "Caring for Quokkas in Distributed Habitats",
    body: "<p>Quokkas thrive on Rottnest Island with reliable water stations.</p>",
    slug: "caring-for-quokkas",
    imageUrl: null,
    summary: "A field guide to quokka care and habitat design.",
    summaryStatus: "COMPLETED",
    authorId: "user-1",
    tagIds: [tag.id],
    likedByMe: false,
    savedByMe: false,
    createdAt: "2025-01-02T00:00:00.000Z",
    updatedAt: "2025-01-02T00:00:00.000Z",
  };
  await previewDB.put("posts", post);
  return post;
};

describe("preview chat store", () => {
  it("creates chats with a default title and scopes lists per user", async () => {
    const userA = buildUser();
    const userB = buildUser();
    await previewDB.put("users", userA);
    await previewDB.put("users", userB);

    const created = await previewCreateChat(userA.id, "   ");
    expect(created.title).toBe("New Chat");

    await previewCreateChat(userA.id, "Second chat");
    const mine = await previewListChats(userA.id, 1, 10);
    expect(mine.totalChats).toBeGreaterThanOrEqual(2);
    expect(mine.chats.map((chat) => chat.id)).toContain(created.id);

    const theirs = await previewListChats(userB.id, 1, 10);
    expect(theirs.chats.map((chat) => chat.id)).not.toContain(created.id);
  });

  it("renames chats and rejects blank titles", async () => {
    const user = buildUser();
    await previewDB.put("users", user);
    const created = await previewCreateChat(user.id, "Old title");

    await expect(previewRenameChat(created.id, user.id, "   ")).rejects.toThrow();
    const renamed = await previewRenameChat(created.id, user.id, "New title");
    expect(renamed.title).toBe("New title");
  });

  it("forbids cross-user chat access and deletes owned chats", async () => {
    const owner = buildUser();
    const stranger = buildUser();
    await previewDB.put("users", owner);
    await previewDB.put("users", stranger);
    const created = await previewCreateChat(owner.id, "Secret");

    expect(await previewGetChat(created.id, stranger.id)).toBeNull();
    await expect(previewDeleteChat(created.id, stranger.id)).rejects.toThrow("forbidden");

    expect(await previewDeleteChat(created.id, owner.id)).toBe(true);
    expect(await previewGetChat(created.id, owner.id)).toBeNull();
  });

  it("grounds answers in matching posts and returns empty citations otherwise", async () => {
    const user = buildUser();
    await previewDB.put("users", user);
    const post = await seedCorpus();
    const chat = await previewCreateChat(user.id, "Wildlife");

    const grounded = await previewAskChat(chat.id, user.id, "How do quokkas live in their habitats?");
    expect(grounded.role).toBe("ASSISTANT");
    expect(grounded.citedPostIds).toContain(post.id);
    expect(grounded.content).toContain("Quokkas");

    const fallback = await previewAskChat(chat.id, user.id, "zxqv wjbh kltp");
    expect(fallback.citedPostIds).toEqual([]);

    const history = await previewListChatMessages(chat.id, user.id, 1, 20);
    expect(history.totalMessages).toBe(4);
    // Newest-first page order mirrors the backend contract.
    expect(history.messages[0].role).toBe("ASSISTANT");
  });

  it("rejects asks on other users chats", async () => {
    const owner = buildUser();
    const stranger = buildUser();
    await previewDB.put("users", owner);
    await previewDB.put("users", stranger);
    const chat = await previewCreateChat(owner.id, "Secret");

    await expect(previewAskChat(chat.id, stranger.id, "hello?")).rejects.toThrow("forbidden");
  });
});
