import type { HttpClient } from "@/shared/api/httpClient";
import { fetchHttpClient } from "@/shared/api/httpClient";

export interface ImageProvider {
  upload(file: File): Promise<string>;
}

export interface CloudinaryConfig {
  cloudName: string;
  uploadPreset: string;
}

const buildCloudinaryUploadUrl = (cloudName: string) =>
  `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

export const cloudinaryImageProvider = (
  config: CloudinaryConfig,
  httpClient: HttpClient = fetchHttpClient,
): ImageProvider => {
  const uploadUrl = () => {
    if (!config.cloudName) {
      throw new Error(
        "Cloudinary configuration is missing. Please check your environment variables.",
      );
    }
    return buildCloudinaryUploadUrl(config.cloudName);
  };

  return {
    async upload(file: File): Promise<string> {
      if (!config.uploadPreset) {
        throw new Error(
          "Cloudinary upload preset is missing. Please check your environment variables.",
        );
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", config.uploadPreset);

      const data = (await httpClient.postFormData(uploadUrl(), formData)) as { secure_url?: unknown };

      const secureUrl = data?.secure_url;
      if (typeof secureUrl !== "string" || secureUrl.length === 0) {
        throw new Error("Failed to get secure URL from Cloudinary response.");
      }

      return secureUrl;
    },
  };
};
