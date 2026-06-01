import { z } from "zod";

const envSchema = z.object({
  VITE_GRAPHQL_URL: z.string().min(1, "VITE_GRAPHQL_URL is required"),
  VITE_BACKEND_URL: z.string().optional(),
  VITE_CLOUDINARY_CLOUD_NAME: z.string().optional(),
  VITE_CLOUDINARY_UPLOAD_PRESET: z.string().optional(),
});

export const env = envSchema.parse({
  VITE_GRAPHQL_URL: import.meta.env.VITE_GRAPHQL_URL,
  VITE_BACKEND_URL: import.meta.env.VITE_BACKEND_URL,
  VITE_CLOUDINARY_CLOUD_NAME: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME,
  VITE_CLOUDINARY_UPLOAD_PRESET: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET,
});
