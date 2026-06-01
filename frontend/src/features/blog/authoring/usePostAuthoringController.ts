import { useCallback, useMemo, useRef, useState } from "react";
import type ReactQuill from "react-quill";
import { useMutation } from "@apollo/client/react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import {
  CreatePostDocument,
  GeneratePostContentDocument,
  GenerateTagsDocument,
  UpdatePostDocument,
  type UpdatePostInput,
} from "@/shared/graphql/content-documents";
import { getGraphQLErrorMessage } from "@/shared/api";
import {
  createPostSchema,
  updatePostSchema,
  type CreatePostFormValues,
  type UpdatePostFormValues,
} from "@/schemas/blog/post.schema";
import { useToast } from "@/hooks/use-toast";
import { useImageUpload } from "@/entities/upload";
import {
  MIN_PROMPT_LENGTH,
  MIN_TAG_BODY_LENGTH,
  MIN_TAG_TITLE_LENGTH,
  normalizeTags,
  toPlainText,
} from "@/entities/post/lib";
import { reportZodIssues } from "./lib/post-validation";

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
};

const REFETCH_POST_LISTS = ["Posts", "PostsByTag", "MyPosts", "SearchPosts"];

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
  const [cardImage, setCardImage] = useState<File | null>(null);
  const [cardImageUrl, setCardImageUrl] = useState<string | null>(
    post?.imageUrl ?? null,
  );
  const [cardImagePreview, setCardImagePreview] = useState<string | null>(
    post?.imageUrl ?? null,
  );
  const [tags, setTags] = useState<string[]>(
    post?.tags.map((tag) => tag.name) ?? [],
  );
  const [newTag, setNewTag] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [postPrompt, setPostPrompt] = useState("");
  const [generatedSummary, setGeneratedSummary] = useState<string | null>(null);
  const [isSummaryVisible, setIsSummaryVisible] = useState(false);

  const quillRef = useRef<ReactQuill>(null);
  const cardImageInputRef = useRef<HTMLInputElement>(null);

  const [createPost, { loading: isCreatingPost }] = useMutation(
    CreatePostDocument,
    { refetchQueries: REFETCH_POST_LISTS },
  );
  const [updatePost, { loading: isUpdating }] = useMutation(
    UpdatePostDocument,
    { refetchQueries: REFETCH_POST_LISTS },
  );
  const [generateTags, { loading: isGeneratingTags }] = useMutation(
    GenerateTagsDocument,
  );
  const [generatePostContent, { loading: isGeneratingPost }] = useMutation(
    GeneratePostContentDocument,
  );

  const { upload: uploadCardImage, isUploading: isUploadingCardImage } =
    useImageUpload();
  const { upload: uploadRichTextImage, isUploading: isUploadingRichText } =
    useImageUpload();

  const contentText = useMemo(() => toPlainText(content), [content]);

  const canGenerateTags =
    title.trim().length >= MIN_TAG_TITLE_LENGTH &&
    contentText.length >= MIN_TAG_BODY_LENGTH;
  const canGeneratePost = postPrompt.trim().length >= MIN_PROMPT_LENGTH;

  const isSubmitting = isUploadingCardImage || isCreatingPost || isUpdating;

  const submitLabel = isUploadingCardImage
    ? "Uploading..."
    : isCreatingPost
      ? "Publishing..."
      : isUpdating
        ? "Saving..."
        : isEdit
          ? "Save Changes"
          : "Publish Post";

  const handleCardImageChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCardImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setCardImagePreview(
        typeof reader.result === "string" ? reader.result : null,
      );
    };
    reader.readAsDataURL(file);
    if (!isEdit) {
      setCardImageUrl(null);
    }
  };

  const uploadCardImageToCloudinary = async (): Promise<string | null> => {
    if (!cardImage) {
      toast({
        title: "No Card Image",
        description: "Please select an image for the blog card.",
        variant: "destructive",
      });
      return null;
    }

    const secureUrl = await uploadCardImage(cardImage, {
      loadingTitle: "Uploading Card Image...",
      successTitle: "Card Image Uploaded",
      errorTitle: "Card Image Upload Failed",
    });

    if (secureUrl) {
      setCardImageUrl(secureUrl);
    }
    return secureUrl;
  };

  const richTextimageHandler = useCallback(async () => {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const imageUrl = await uploadRichTextImage(file);
      if (!imageUrl) return;
      const quill = quillRef.current?.getEditor();
      if (!quill) return;
      const range = quill.getSelection(true);
      quill.insertEmbed(range.index, "image", imageUrl);
      quill.setSelection(range.index + 1, 0);
    };
  }, [uploadRichTextImage]);

  const handleGenerateTags = async () => {
    if (!canGenerateTags) {
      toast({
        title: "Not Enough Content",
        description:
          "Add a longer title and more content before generating tags.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data } = await generateTags({
        variables: { title: title.trim(), body: contentText },
      });
      const generated = normalizeTags(data?.generateTags ?? []);

      if (generated.length === 0) {
        toast({
          title: "No Tags Generated",
          description: "Try adding more context and generate again.",
          variant: "destructive",
        });
        return;
      }

      setTags(normalizeTags([...tags, ...generated]));
      toast({
        title: "Tags Generated",
        description: `Added ${generated.length} tag${generated.length === 1 ? "" : "s"}.`,
      });
    } catch (error) {
      toast({
        title: "Tag Generation Failed",
        description: getGraphQLErrorMessage(
          error,
          "Unable to generate tags right now.",
        ),
        variant: "destructive",
      });
    }
  };

  const handleGeneratePost = async () => {
    if (!canGeneratePost) {
      toast({
        title: "Prompt Too Short",
        description: "Provide a longer prompt to generate a full draft.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data } = await generatePostContent({
        variables: { prompt: postPrompt.trim() },
      });

      const generated = data?.generatePostContent;
      if (!generated?.title || !generated?.body) {
        toast({
          title: "Incomplete Draft",
          description: "The generated draft is missing required content.",
          variant: "destructive",
        });
        return;
      }

      setTitle(generated.title);
      setContent(generated.body);
      setTags(normalizeTags(generated.tags ?? []));
      setGeneratedSummary(generated.summary ?? null);
      setIsSummaryVisible(false);
      toast({
        title: "Draft Generated",
        description: "Title, content, and tags have been updated.",
      });
    } catch (error) {
      toast({
        title: "Post Generation Failed",
        description: getGraphQLErrorMessage(
          error,
          "Unable to generate a draft right now.",
        ),
        variant: "destructive",
      });
    }
  };

  const handleAddTag = () => {
    const trimmed = newTag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setNewTag("");
      setIsDialogOpen(false);
      return;
    }
    if (!trimmed) {
      toast({
        title: "Empty Tag",
        description: "Tag cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Duplicate Tag",
      description: "This tag has already been added.",
      variant: "destructive",
    });
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleCreateSubmit = async (
    event: React.FormEvent,
  ): Promise<void> => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !contentText) {
      toast({
        title: "Missing Information",
        description: "Title and content are required.",
        variant: "destructive",
      });
      return;
    }

    let finalCardImageUrl = cardImageUrl;
    if (cardImage && !finalCardImageUrl) {
      finalCardImageUrl = await uploadCardImageToCloudinary();
      if (!finalCardImageUrl) return;
    }

    if (!finalCardImageUrl) {
      toast({
        title: "Missing Card Image",
        description: "Please upload a card image for the blog.",
        variant: "destructive",
      });
      return;
    }

    const candidate: CreatePostFormValues = {
      title: trimmedTitle,
      body: content,
      summary: generatedSummary?.trim() || undefined,
      tags,
      imageUrl: finalCardImageUrl,
    };

    try {
      const parsed = createPostSchema.parse(candidate);
      await createPost({ variables: { input: parsed } });
      toast({ title: "Blog Created", description: "Successfully created." });
      navigate("/");
    } catch (error) {
      if (error instanceof z.ZodError) {
        reportZodIssues(toast, error.issues);
        return;
      }
      toast({
        title: "Error",
        description: getGraphQLErrorMessage(
          error,
          "Failed to create blog post.",
        ),
        variant: "destructive",
      });
    }
  };

  const handleEditSubmit = async (
    event: React.FormEvent,
  ): Promise<void> => {
    event.preventDefault();
    if (!post) return;

    let finalImageUrl = cardImageUrl;
    if (cardImage) {
      const uploadedUrl = await uploadCardImage(cardImage, {
        loadingTitle: "Uploading featured image...",
        successTitle: "Image uploaded",
      });
      if (!uploadedUrl) return;
      finalImageUrl = uploadedUrl;
    }

    const originalTagNames = post.tags.map((tag) => tag.name);
    const updateData: Partial<UpdatePostFormValues> = {};
    if (title !== post.title) updateData.title = title;
    if (content !== post.body) updateData.body = content;
    if (JSON.stringify(tags) !== JSON.stringify(originalTagNames)) {
      updateData.tags = tags;
    }
    if (finalImageUrl !== post.imageUrl) updateData.imageUrl = finalImageUrl;

    if (Object.keys(updateData).length === 0) {
      toast({ title: "No Changes", description: "No changes detected." });
      onComplete?.();
      return;
    }

    try {
      const parsedInput = updatePostSchema.parse(updateData) as UpdatePostInput;
      await updatePost({ variables: { id: post.id, input: parsedInput } });
      toast({ title: "Success", description: "Post updated successfully." });
      onComplete?.();
    } catch (error) {
      if (error instanceof z.ZodError) {
        reportZodIssues(toast, error.issues);
        return;
      }
      toast({
        title: "Update Failed",
        description: getGraphQLErrorMessage(
          error,
          "Could not update post.",
        ),
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (
    event: React.FormEvent,
  ): Promise<void> => {
    if (isEdit) return handleEditSubmit(event);
    return handleCreateSubmit(event);
  };

  const handleCancel = () => {
    if (isEdit) {
      onComplete?.();
      return;
    }
    toast({ title: "Action Cancelled", description: "Blog creation cancelled." });
    navigate("/");
  };

  const clearAIDraft = () => {
    setPostPrompt("");
    setGeneratedSummary(null);
    setIsSummaryVisible(false);
  };

  const toggleSummary = () => setIsSummaryVisible((value) => !value);

  return {
    state: {
      mode,
      title,
      content,
      cardImage,
      cardImageUrl,
      cardImagePreview,
      isUploadingCardImage,
      isUploadingRichText,
      tags,
      newTag,
      isDialogOpen,
      isGeneratingTags,
      canGenerateTags,
      isSubmitting,
      submitLabel,
      postPrompt,
      generatedSummary,
      isSummaryVisible,
      isGeneratingPost,
      canGeneratePost,
      contentText,
      isTitleReady: title.trim().length > 0,
      isContentReady: contentText.length > 0,
      isCoverImageReady: Boolean(
        cardImage || cardImageUrl || cardImagePreview,
      ),
    },
    setters: {
      setTitle,
      setContent,
      setNewTag,
      setIsDialogOpen,
      setPostPrompt,
      setGeneratedSummary,
      setIsSummaryVisible,
    },
    handlers: {
      handleCardImageChange,
      handleGenerateTags,
      handleAddTag,
      handleRemoveTag,
      handleSubmit,
      handleCancel,
      handleGeneratePost,
      richTextimageHandler,
      clearAIDraft,
      toggleSummary,
    },
    refs: {
      quillRef,
      cardImageInputRef,
    },
  };
};
