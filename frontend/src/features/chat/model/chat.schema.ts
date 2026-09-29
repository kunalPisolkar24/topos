import { z } from "zod";

export const MAX_CHAT_QUERY_CHARS = 5000;

export const chatQuerySchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "Message is required")
    .max(MAX_CHAT_QUERY_CHARS, `Message must be under ${MAX_CHAT_QUERY_CHARS} characters`),
});

export type ChatQueryFormValues = z.infer<typeof chatQuerySchema>;

export const chatTitleSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(80, "Title must be under 80 characters"),
});

export type ChatTitleFormValues = z.infer<typeof chatTitleSchema>;
