import { useMemo, useRef, useState } from "react";
import type ReactQuill from "react-quill";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/shared/ui/hooks/useToast";
import { toPlainText } from "@/entities/post/lib";
import {
  isSubmitInFlight,
  submitLabel as deriveSubmitLabel,
  type PostAuthoringSubmitState,
} from "./model/submit-state";
import { usePostAIDraft } from "./hooks/usePostAIDraft";
import { usePostImageUploader } from "./hooks/usePostImageUploader";
import { usePostTagInput } from "./hooks/usePostTagInput";
import { usePostAuthoringSubmit } from "./hooks/usePostAuthoringSubmit";

export type PostAuthoringMode = "create" | "edit";

export interface PostForEditing {
  id: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  tags: ReadonlyArray<{ id: string; name: string }>;
}

export interface UsePostAuthoringControllerProps {
  mode: PostAuthoringMode;
  post?: PostForEditing;
  onComplete?: () => void;
}

export interface PostAuthoringState {
  mode: PostAuthoringMode;
  title: string;
  content: string;
  cardImage: File | null;
  cardImageUrl: string | null;
  cardImagePreview: string | null;
  isUploadingCardImage: boolean;
  isUploadingRichText: boolean;
  tags: string[];
  newTag: string;
  isDialogOpen: boolean;
  isGeneratingTags: boolean;
  canGenerateTags: boolean;
  isSubmitting: boolean;
  submitLabel: string;
  submit: PostAuthoringSubmitState;
  postPrompt: string;
  generatedSummary: string | null;
  isSummaryVisible: boolean;
  isGeneratingPost: boolean;
  canGeneratePost: boolean;
  contentText: string;
  isTitleReady: boolean;
  isContentReady: boolean;
  isCoverImageReady: boolean;
}

export interface PostAuthoringHandlers {
  handleCardImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleGenerateTags: () => Promise<void>;
  handleAddTag: () => void;
  handleRemoveTag: (tag: string) => void;
  handleSubmit: (event: React.FormEvent) => Promise<void>;
  handleCancel: () => void;
  handleGeneratePost: () => Promise<void>;
  richTextimageHandler: () => Promise<void>;
  clearAIDraft: () => void;
  toggleSummary: () => void;
}

export interface PostAuthoringController {
  state: PostAuthoringState;
  setters: {
    setTitle: (value: string) => void;
    setContent: (value: string) => void;
    setNewTag: (value: string) => void;
    setIsDialogOpen: (open: boolean) => void;
    setPostPrompt: (value: string) => void;
    setGeneratedSummary: (value: string | null) => void;
    setIsSummaryVisible: (visible: boolean) => void;
  };
  handlers: PostAuthoringHandlers;
  refs: {
    quillRef: React.MutableRefObject<ReactQuill | null>;
    cardImageInputRef: React.MutableRefObject<HTMLInputElement | null>;
  };
}

export const usePostAuthoringController = ({
  mode,
  post,
  onComplete,
}: UsePostAuthoringControllerProps): PostAuthoringController => {
  const isEdit = mode === "edit";
  const navigate = useNavigate();
  const { toast } = useToast();

  const [title, setTitle] = useState(post?.title ?? "");
  const [content, setContent] = useState(post?.body ?? "");

  const contentText = useMemo(() => toPlainText(content), [content]);
  const cardImageInputRef = useRef<HTMLInputElement | null>(null);

  const tagInput = usePostTagInput({
    initialTags: post?.tags.map((tag) => tag.name) ?? [],
    title,
    contentText,
  });

  const imageUploader = usePostImageUploader({
    initialImageUrl: post?.imageUrl ?? null,
    isEdit,
  });

  const aiDraft = usePostAIDraft({
    onTitleChange: setTitle,
    onContentChange: setContent,
    onTagsChange: tagInput.replaceTags,
  });

  const submitController = usePostAuthoringSubmit({
    mode,
    post,
    title,
    content,
    contentText,
    imageFile: imageUploader.file,
    imageUrl: imageUploader.url,
    tags: tagInput.tags,
    summary: aiDraft.summary,
    uploadCardImage: () => imageUploader.uploadCardImage(),
    onComplete,
  });

  const handleCancel = () => {
    if (isEdit) {
      onComplete?.();
      return;
    }
    toast({ title: "Action Cancelled", description: "Blog creation cancelled." });
    navigate("/");
  };

  return {
    state: {
      mode,
      title,
      content,
      cardImage: imageUploader.file,
      cardImageUrl: imageUploader.url,
      cardImagePreview: imageUploader.preview,
      isUploadingCardImage: imageUploader.isCardUploading,
      isUploadingRichText: imageUploader.isRichTextUploading,
      tags: tagInput.tags,
      newTag: tagInput.newTag,
      isDialogOpen: tagInput.isDialogOpen,
      isGeneratingTags: tagInput.isGenerating,
      canGenerateTags: tagInput.canGenerate,
      isSubmitting: isSubmitInFlight(submitController.submit),
      submitLabel: deriveSubmitLabel(submitController.submit, isEdit),
      submit: submitController.submit,
      postPrompt: aiDraft.prompt,
      generatedSummary: aiDraft.summary,
      isSummaryVisible: aiDraft.isSummaryVisible,
      isGeneratingPost: aiDraft.isGenerating,
      canGeneratePost: aiDraft.canGenerate,
      contentText,
      isTitleReady: title.trim().length > 0,
      isContentReady: contentText.length > 0,
      isCoverImageReady: Boolean(
        imageUploader.file || imageUploader.url || imageUploader.preview,
      ),
    },
    setters: {
      setTitle,
      setContent,
      setNewTag: tagInput.setNewTag,
      setIsDialogOpen: tagInput.setIsDialogOpen,
      setPostPrompt: aiDraft.setPrompt,
      setGeneratedSummary: aiDraft.setSummary,
      setIsSummaryVisible: aiDraft.setIsSummaryVisible,
    },
    handlers: {
      handleCardImageChange: imageUploader.handleFileChange,
      handleGenerateTags: tagInput.generateTags,
      handleAddTag: tagInput.addTag,
      handleRemoveTag: tagInput.removeTag,
      handleSubmit: submitController.handleSubmit,
      handleCancel,
      handleGeneratePost: aiDraft.generate,
      richTextimageHandler: imageUploader.richTextImageHandler,
      clearAIDraft: aiDraft.clear,
      toggleSummary: aiDraft.toggleSummary,
    },
    refs: {
      quillRef: imageUploader.quillRef,
      cardImageInputRef,
    },
  };
};
