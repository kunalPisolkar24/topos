import { z } from "zod";
import { logger } from "@/shared/lib/logger";

const envSchema = z.object({
  VITE_GRAPHQL_URL: z.string().min(1, "VITE_GRAPHQL_URL is required"),
  VITE_BACKEND_URL: z.string().optional(),
  VITE_CLOUDINARY_CLOUD_NAME: z.string().optional(),
  VITE_CLOUDINARY_UPLOAD_PRESET: z.string().optional(),
});

const parsed = envSchema.safeParse({
  VITE_GRAPHQL_URL: import.meta.env.VITE_GRAPHQL_URL,
  VITE_BACKEND_URL: import.meta.env.VITE_BACKEND_URL,
  VITE_CLOUDINARY_CLOUD_NAME: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME,
  VITE_CLOUDINARY_UPLOAD_PRESET: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET,
});

if (!parsed.success) {
  logger.error("Invalid environment configuration", parsed.error.flatten());
}

export const hasValidEnv = parsed.success;

export const getEnvError = () =>
  parsed.success ? null : parsed.error.flatten();

export const env = parsed.success
  ? parsed.data
  : {
      VITE_GRAPHQL_URL: import.meta.env.VITE_GRAPHQL_URL ?? "",
      VITE_BACKEND_URL: import.meta.env.VITE_BACKEND_URL,
      VITE_CLOUDINARY_CLOUD_NAME: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME,
      VITE_CLOUDINARY_UPLOAD_PRESET: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET,
    };
