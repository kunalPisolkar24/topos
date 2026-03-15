import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { uploadToCloudinary } from "@/lib/cloudinary";

interface UploadOptions {
  loadingTitle?: string;
  successTitle?: string;
  errorTitle?: string;
}

export const useImageUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const upload = useCallback(
    async (file: File, options?: UploadOptions): Promise<string | null> => {
      setIsUploading(true);
      try {
        toast({
          title: options?.loadingTitle || "Uploading image...",
          description: "Please wait.",
        });

        const url = await uploadToCloudinary(file);

        toast({
          title: options?.successTitle || "Upload successful",
          description: "Your image has been uploaded successfully.",
        });

        return url;
      } catch (error) {
        toast({
          title: options?.errorTitle || "Upload failed",
          description: error instanceof Error ? error.message : "An unexpected error occurred.",
          variant: "destructive",
        });
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [toast]
  );

  return { upload, isUploading };
};
