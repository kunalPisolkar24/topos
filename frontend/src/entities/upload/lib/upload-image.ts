import { domainError, err, ok, type Result } from "@/shared/domain";
import type { ImageProvider } from "./image-provider";

export type ImageUploadError = ReturnType<typeof imageUploadError>;

export const imageUploadError = (message: string, cause?: unknown) =>
  domainError("NETWORK", message, cause !== undefined ? { cause } : {});

export const uploadImage = async (
  file: File,
  provider: ImageProvider,
): Promise<Result<string, ImageUploadError>> => {
  try {
    const url = await provider.upload(file);
    return ok(url);
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "An unexpected upload error occurred.";
    return err(imageUploadError(message, cause));
  }
};
