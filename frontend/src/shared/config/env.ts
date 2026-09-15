import { z } from "zod";
import { logger } from "@/shared/lib/logger";

const envSchema = z.object({
  VITE_ENV_TYPE: z.enum(["preview", "dev", "prod"]).default("dev"),
  VITE_GRAPHQL_URL: z.string().min(1, "VITE_GRAPHQL_URL is required"),
  VITE_BACKEND_URL: z.string().optional(),
  VITE_CLOUDINARY_CLOUD_NAME: z.string().optional(),
  VITE_CLOUDINARY_UPLOAD_PRESET: z.string().optional(),
  VITE_ENABLE_MOCKS: z.string().optional(),
});

const parsed = envSchema.safeParse({
  VITE_ENV_TYPE: import.meta.env.VITE_ENV_TYPE,
  VITE_GRAPHQL_URL: import.meta.env.VITE_GRAPHQL_URL,
  VITE_BACKEND_URL: import.meta.env.VITE_BACKEND_URL,
  VITE_CLOUDINARY_CLOUD_NAME: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME,
  VITE_CLOUDINARY_UPLOAD_PRESET: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET,
  VITE_ENABLE_MOCKS: import.meta.env.VITE_ENABLE_MOCKS,
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
      VITE_ENV_TYPE: (import.meta.env.VITE_ENV_TYPE as "preview" | "dev" | "prod") ?? "dev",
      VITE_GRAPHQL_URL: import.meta.env.VITE_GRAPHQL_URL ?? "",
      VITE_BACKEND_URL: import.meta.env.VITE_BACKEND_URL,
      VITE_CLOUDINARY_CLOUD_NAME: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME,
      VITE_CLOUDINARY_UPLOAD_PRESET: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET,
      VITE_ENABLE_MOCKS: import.meta.env.VITE_ENABLE_MOCKS,
    };

export const isPreviewEnv = env.VITE_ENV_TYPE === "preview";
export const shouldEnableMocks = isPreviewEnv || env.VITE_ENABLE_MOCKS === "true";
