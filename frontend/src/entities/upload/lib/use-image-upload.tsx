import { useCallback, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { env } from "@/shared/config/env";
import {
  cloudinaryImageProvider,
  type ImageProvider,
} from "./image-provider";
import { uploadImage } from "./upload-image";

export interface ImageUploadOptions {
  loadingTitle?: string;
  successTitle?: string;
  errorTitle?: string;
}

let defaultProvider: ImageProvider | null = null;

const getDefaultProvider = (): ImageProvider => {
  if (defaultProvider === null) {
    defaultProvider = cloudinaryImageProvider({
      cloudName: env.VITE_CLOUDINARY_CLOUD_NAME ?? "",
      uploadPreset: env.VITE_CLOUDINARY_UPLOAD_PRESET ?? "",
    });
  }
  return defaultProvider;
};

export const resetDefaultImageUploadProviderForTests = () => {
  defaultProvider = null;
};

export const useImageUpload = (
  provider: ImageProvider = getDefaultProvider(),
) => {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const upload = useCallback(
    async (
      file: File,
      options?: ImageUploadOptions,
    ): Promise<string | null> => {
      setIsUploading(true);
      try {
        toast({
          title: options?.loadingTitle ?? "Uploading image...",
          description: "Please wait.",
        });

        const result = await uploadImage(file, provider);

        if (result.ok) {
          toast({
            title: options?.successTitle ?? "Upload successful",
            description: "Your image has been uploaded successfully.",
          });
          return result.value;
        }

        toast({
          title: options?.errorTitle ?? "Upload failed",
          description: result.error.message,
          variant: "destructive",
        });
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [provider, toast],
  );

  return { upload, isUploading };
};
