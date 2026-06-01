import { useCallback, useRef, useState } from "react";
import type ReactQuill from "react-quill";
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

export const usePostImageUploader = ({
  initialImageUrl = null,
  isEdit = false,
}: UsePostImageUploaderArgs): UsePostImageUploaderResult => {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(initialImageUrl);
  const [preview, setPreview] = useState<string | null>(initialImageUrl);
  const quillRef = useRef<ReactQuill | null>(null);

  const { upload: uploadCard, isUploading: isCardUploading } = useImageUpload();
  const { upload: uploadRichText, isUploading: isRichTextUploading } =
    useImageUpload();

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const next = event.target.files?.[0];
    if (!next) return;
    setFile(next);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(typeof reader.result === "string" ? reader.result : null);
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
    input.click();
    input.onchange = async () => {
      const next = input.files?.[0];
      if (!next) return;
      const imageUrl = await uploadRichText(next);
      if (!imageUrl) return;
      const quill = quillRef.current?.getEditor();
      if (!quill) return;
      const range = quill.getSelection(true);
      quill.insertEmbed(range.index, "image", imageUrl);
      quill.setSelection(range.index + 1, 0);
    };
  }, [uploadRichText]);

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
