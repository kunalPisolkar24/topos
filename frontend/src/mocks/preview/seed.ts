import { previewDB } from "./preview-db";
import { PREVIEW_SEED_VERSION } from "@/shared/config/preview";

export async function ensurePreviewSeed(): Promise<void> {
  if (await previewDB.isSeeded()) return;

  const { seedUsers, seedTags, seedPosts, seedDrafts, seedChats, seedChatMessages } =
    await import("@/mocks/data");

  for (const user of seedUsers as unknown[]) await previewDB.put("users", user as never);
  for (const tag of seedTags as unknown[]) await previewDB.put("tags", tag as never);
  for (const post of seedPosts as unknown[]) await previewDB.put("posts", post as never);
  for (const draft of seedDrafts as unknown[]) await previewDB.put("drafts", draft as never);
  for (const chat of seedChats as unknown[]) await previewDB.put("chats", chat as never);
  for (const message of seedChatMessages as unknown[])
    await previewDB.put("messages", message as never);
  await previewDB.setMeta("seedVersion", PREVIEW_SEED_VERSION);
}


