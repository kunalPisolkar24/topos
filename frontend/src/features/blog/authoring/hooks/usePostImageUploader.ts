import { useCallback, useEffect, useRef, useState } from "react";
import type ReactQuill from "react-quill-new";
import { useImageUpload } from "@/entities/upload";
import { useToast } from "@/shared/ui/hooks/useToast";

export interface UsePostImageUploaderArgs {
  initialImageUrl?: string | null;
  isEdit?: boolean;
}

export interface UploadCardImageOptions {
  loadingTitle?: string;
  successTitle?: string;
  errorTitle?: string;
}

export interface UsePostImageUploaderResult {
  file: File | null;
  url: string | null;
  preview: string | null;
  isCardUploading: boolean;
  isRichTextUploading: boolean;
  quillRef: React.MutableRefObject<ReactQuill | null>;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  uploadCardImage: (options?: UploadCardImageOptions) => Promise<string | null>;
  richTextImageHandler: () => Promise<void>;
}

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

const isImageFile = (file: File): boolean =>
  file.type.startsWith("image/");

const validateImageFile = (
  file: File,
  toast: ReturnType<typeof useToast>["toast"],
): boolean => {
  if (!isImageFile(file)) {
    toast({
      title: "Invalid file type",
      description: "Please select an image file.",
      variant: "destructive",
    });
    return false;
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    toast({
      title: "File too large",
      description: "Image must be smaller than 10MB.",
      variant: "destructive",
    });
    return false;
  }
  return true;
};

export const usePostImageUploader = ({
  initialImageUrl = null,
  isEdit = false,
}: UsePostImageUploaderArgs): UsePostImageUploaderResult => {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(initialImageUrl);
  const [preview, setPreview] = useState<string | null>(initialImageUrl);
  const quillRef = useRef<ReactQuill | null>(null);
  const readerRef = useRef<FileReader | null>(null);

  const { upload: uploadCard, isUploading: isCardUploading } = useImageUpload();
  const { upload: uploadRichText, isUploading: isRichTextUploading } =
    useImageUpload();

  useEffect(() => {
    return () => {
      if (
        readerRef.current &&
        readerRef.current.readyState === FileReader.LOADING
      ) {
        readerRef.current.abort();
      }
    };
  }, []);

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const next = event.target.files?.[0];
    if (!next) return;
    if (!validateImageFile(next, toast)) return;
    if (
      readerRef.current &&
      readerRef.current.readyState === FileReader.LOADING
    ) {
      readerRef.current.abort();
    }
    setFile(next);
    const reader = new FileReader();
    readerRef.current = reader;
    reader.onloadend = () => {
      setPreview(typeof reader.result === "string" ? reader.result : null);
    };
    reader.onerror = () => {
      toast({
        title: "Preview failed",
        description: "Failed to read image file.",
        variant: "destructive",
      });
    };
    reader.onabort = () => {
      toast({
        title: "Preview aborted",
        description: "Image preview was cancelled.",
        variant: "destructive",
      });
    };
    reader.readAsDataURL(next);
    if (!isEdit) {
      setUrl(null);
    }
  };

  const uploadCardImage = async (
    options?: UploadCardImageOptions,
  ): Promise<string | null> => {
    if (!file) {
      toast({
        title: "No Card Image",
        description: "Please select an image for the blog card.",
        variant: "destructive",
      });
      return null;
    }

    const secureUrl = await uploadCard(file, {
      loadingTitle: options?.loadingTitle ?? "Uploading Card Image...",
      successTitle: options?.successTitle ?? "Card Image Uploaded",
      errorTitle: options?.errorTitle ?? "Card Image Upload Failed",
    });

    if (secureUrl) {
      setUrl(secureUrl);
    }
    return secureUrl;
  };

  const richTextImageHandler = useCallback(async () => {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.onchange = async () => {
      const next = input.files?.[0];
      if (!next) return;
      if (!validateImageFile(next, toast)) return;
      const imageUrl = await uploadRichText(next);
      if (!imageUrl) return;
      const quill = quillRef.current?.getEditor();
      if (!quill) return;
      const range = quill.getSelection(true);
      if (!range) return;
      quill.insertEmbed(range.index, "image", imageUrl);
      quill.setSelection(range.index + 1, 0);
    };
    input.click();
  }, [uploadRichText, toast]);

  return {
    file,
    url,
    preview,
    isCardUploading,
    isRichTextUploading,
    quillRef,
    handleFileChange,
    uploadCardImage,
    richTextImageHandler,
  };
};
