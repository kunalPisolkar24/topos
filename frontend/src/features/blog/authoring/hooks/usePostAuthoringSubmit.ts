import { useCallback, useReducer } from "react";
import { z } from "zod";
import { useApolloClient, useMutation } from "@apollo/client/react";
import { useNavigate } from "react-router-dom";
import {
  CreatePostDocument,
  UpdatePostDocument,
  type UpdatePostInput,
} from "@/shared/graphql/content-documents";
import { getGraphQLErrorMessage, POST_LIST_QUERY_NAMES } from "@/shared/api";
import { useToast } from "@/shared/ui/hooks/useToast";
import {
  createPostSchema,
  updatePostSchema,
  type CreatePostFormValues,
  type UpdatePostFormValues,
} from "@/features/blog/authoring/model/post.schema";
import { reportZodIssues } from "@/features/blog/authoring/lib/post-validation";
import type { PostForEditing, PostAuthoringMode } from "../usePostAuthoringController";
import type { PostAuthoringSubmitState } from "../model/submit-state";

type SubmitAction =
  | { type: "beginUpload" }
  | { type: "beginCreate" }
  | { type: "beginUpdate" }
  | { type: "resolveIdle" }
  | { type: "fail"; message: string };

const reducer = (
  _state: PostAuthoringSubmitState,
  action: SubmitAction,
): PostAuthoringSubmitState => {
  switch (action.type) {
    case "beginUpload":
      return { kind: "uploading" };
    case "beginCreate":
      return { kind: "creating" };
    case "beginUpdate":
      return { kind: "updating" };
    case "resolveIdle":
      return { kind: "idle" };
    case "fail":
      return { kind: "error", message: action.message };
  }
};

export interface UsePostAuthoringSubmitArgs {
  mode: PostAuthoringMode;
  post?: PostForEditing;
  title: string;
  content: string;
  contentText: string;
  imageFile: File | null;
  imageUrl: string | null;
  tags: string[];
  summary: string | null;
  uploadCardImage: () => Promise<string | null>;
  onComplete?: () => void;
}

export interface UsePostAuthoringSubmitResult {
  submit: PostAuthoringSubmitState;
  handleSubmit: (event: React.FormEvent) => Promise<void>;
}

export const usePostAuthoringSubmit = ({
  mode,
  post,
  title,
  content,
  contentText,
  imageFile,
  imageUrl,
  tags,
  summary,
  uploadCardImage,
  onComplete,
}: UsePostAuthoringSubmitArgs): UsePostAuthoringSubmitResult => {
  const isEdit = mode === "edit";
  const navigate = useNavigate();
  const { toast } = useToast();
  const client = useApolloClient();
  const [submit, dispatch] = useReducer(reducer, { kind: "idle" });

  const [createPost] = useMutation(CreatePostDocument, {
    refetchQueries: POST_LIST_QUERY_NAMES,
  });
  const [updatePost] = useMutation(UpdatePostDocument, {
    refetchQueries: POST_LIST_QUERY_NAMES,
  });

  const handleCreateSubmit = useCallback(
    async (event: React.FormEvent) => {
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

      let finalImageUrl = imageUrl;
      if (imageFile && !finalImageUrl) {
        dispatch({ type: "beginUpload" });
        finalImageUrl = await uploadCardImage();
        if (!finalImageUrl) {
          dispatch({ type: "resolveIdle" });
          return;
        }
      }

      if (!finalImageUrl) {
        toast({
          title: "Missing Card Image",
          description: "Please upload a card image for the blog.",
          variant: "destructive",
        });
        dispatch({ type: "resolveIdle" });
        return;
      }

      const candidate: CreatePostFormValues = {
        title: trimmedTitle,
        body: content,
        summary: summary?.trim() || undefined,
        tags,
        imageUrl: finalImageUrl,
      };

      try {
        const parsed = createPostSchema.parse(candidate);
        dispatch({ type: "beginCreate" });
        await createPost({ variables: { input: parsed } });
        await client.refetchQueries({ include: POST_LIST_QUERY_NAMES });
        toast({ title: "Blog Created", description: "Successfully created." });
        dispatch({ type: "resolveIdle" });
        navigate("/");
      } catch (error) {
        if (error instanceof z.ZodError) {
          reportZodIssues(toast, error.issues);
          dispatch({ type: "resolveIdle" });
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
        dispatch({ type: "fail", message: "create" });
      }
    },
    [
      title,
      content,
      contentText,
      imageFile,
      imageUrl,
      tags,
      summary,
      uploadCardImage,
      toast,
      createPost,
      client,
      navigate,
    ],
  );

  const handleEditSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!post) return;

      let finalImageUrl = imageUrl;
      if (imageFile) {
        dispatch({ type: "beginUpload" });
        const uploadedUrl = await uploadCardImage();
        if (!uploadedUrl) {
          dispatch({ type: "resolveIdle" });
          return;
        }
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
        dispatch({ type: "beginUpdate" });
        await updatePost({ variables: { id: post.id, input: parsedInput } });
        toast({ title: "Success", description: "Post updated successfully." });
        dispatch({ type: "resolveIdle" });
        onComplete?.();
      } catch (error) {
        if (error instanceof z.ZodError) {
          reportZodIssues(toast, error.issues);
          dispatch({ type: "resolveIdle" });
          return;
        }
        toast({
          title: "Update Failed",
          description: getGraphQLErrorMessage(error, "Could not update post."),
          variant: "destructive",
        });
        dispatch({ type: "fail", message: "update" });
      }
    },
    [
      post,
      title,
      content,
      imageFile,
      imageUrl,
      tags,
      uploadCardImage,
      toast,
      updatePost,
      onComplete,
    ],
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      if (isEdit) return handleEditSubmit(event);
      return handleCreateSubmit(event);
    },
    [isEdit, handleCreateSubmit, handleEditSubmit],
  );

  return { submit, handleSubmit };
};
