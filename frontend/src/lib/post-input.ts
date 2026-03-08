import { z } from "zod";
import type { CreatePostInput } from "@/graphql/content-documents";

export const createPostSchema: z.ZodType<CreatePostInput> = z.object({
  title: z.string().trim().min(1, "Title is required"),
  body: z.string().trim().min(1, "Body content is required"),
  tags: z.array(z.string().trim().min(1, "Tags cannot be empty")).nullish(),
  imageUrl: z.string().url("Invalid image URL format").nullish(),
});
