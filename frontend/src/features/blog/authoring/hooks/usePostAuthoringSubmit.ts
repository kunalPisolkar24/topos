import { useCallback, useReducer, useRef } from "react";
import { useApolloClient } from "@apollo/client/react";
import { useNavigate } from "react-router-dom";
import type { ContentDraftInput } from "@/shared/graphql/content-documents";
import { draftRepository } from "@/entities/draft/api/draftRepository";
import { getGraphQLErrorMessage } from "@/shared/api";
import { useToast } from "@/shared/ui/hooks/useToast";
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
  previewCoverUrl?: string | null;
  tags: string[];
  summary: string | null;
  uploadCardImage: () => Promise<string | null>;
  onComplete?: () => void;
  resubmitDraftId?: string;
  resubmitPostId?: string | null;
  initialSummary?: string | null;
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
  previewCoverUrl,
  tags,
  summary,
  uploadCardImage,
  onComplete,
  resubmitDraftId,
  resubmitPostId,
  initialSummary,
}: UsePostAuthoringSubmitArgs): UsePostAuthoringSubmitResult => {
  const isEdit = mode === "edit";
  const isResubmit = mode === "resubmit";
  const navigate = useNavigate();
  const { toast } = useToast();
  const client = useApolloClient();
  const [submit, dispatch] = useReducer(reducer, { kind: "idle" });
  const isSubmittingRef = useRef(false);

  const [createContentDraft] = draftRepository.useCreateContentDraft();
  const [resubmitContentDraft] = draftRepository.useResubmitContentDraft();

  const handleCreateSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;
      try {
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

        if (!finalImageUrl && previewCoverUrl) {
          finalImageUrl = previewCoverUrl;
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

        // Review-first publishing: every new post enters the queue as
        // PENDING. Nothing goes live until a peer approves it.
        const draftInput: ContentDraftInput = {
          title: trimmedTitle,
          body: content,
          summary: summary?.trim() || null,
          tags,
          imageUrl: finalImageUrl,
          postId: null,
        };
        try {
          dispatch({ type: "beginCreate" });
          await createContentDraft({ variables: { input: draftInput } });
          await draftRepository.refreshDraftLists(client);
          toast({
            title: "Submitted for review",
            description: "Your post is pending. It goes live after peer approval.",
          });
          dispatch({ type: "resolveIdle" });
          navigate("/review");
        } catch (error) {
          toast({
            title: "Error",
            description: getGraphQLErrorMessage(
              error,
              "Failed to submit the post for review.",
            ),
            variant: "destructive",
          });
          dispatch({ type: "fail", message: "create" });
        } finally {
          isSubmittingRef.current = false;
        }
      } finally {
        isSubmittingRef.current = false;
      }
    },
    [
      title,
      content,
      contentText,
      imageFile,
      imageUrl,
      previewCoverUrl,
      tags,
      summary,
      uploadCardImage,
      toast,
      createContentDraft,
      client,
      navigate,
    ],
  );

  const handleEditSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (isSubmittingRef.current) return;
      if (!post) return;
      isSubmittingRef.current = true;
      try {
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
        const hasChanges =
          title !== post.title ||
          content !== post.body ||
          JSON.stringify(tags) !== JSON.stringify(originalTagNames) ||
          finalImageUrl !== post.imageUrl;

        if (!hasChanges) {
          toast({ title: "No Changes", description: "No changes detected." });
          onComplete?.();
          return;
        }

        // Review-first publishing: edits become a revision proposal.
        // The live post is untouched until a peer approves it.
        const revisionInput: ContentDraftInput = {
          title,
          body: content,
          summary: null,
          tags,
          imageUrl: finalImageUrl,
          postId: post.id,
        };
        try {
          dispatch({ type: "beginUpdate" });
          await createContentDraft({ variables: { input: revisionInput } });
          await draftRepository.refreshDraftLists(client);
          toast({
            title: "Revision submitted",
            description: "Your changes are pending. They go live after peer approval.",
          });
          dispatch({ type: "resolveIdle" });
          onComplete?.();
        } catch (error) {
          toast({
            title: "Update Failed",
            description: getGraphQLErrorMessage(error, "Could not submit the revision."),
            variant: "destructive",
          });
          dispatch({ type: "fail", message: "update" });
        } finally {
          isSubmittingRef.current = false;
        }
      } finally {
        isSubmittingRef.current = false;
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
      createContentDraft,
      client,
      onComplete,
    ],
  );

  const handleResubmitSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (isSubmittingRef.current) return;
      if (!post || !resubmitDraftId) return;
      isSubmittingRef.current = true;
      try {
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
        const hasChanges =
          trimmedTitle !== post.title ||
          content !== post.body ||
          JSON.stringify(tags) !== JSON.stringify(originalTagNames) ||
          (finalImageUrl ?? null) !== (post.imageUrl ?? null);

        if (!hasChanges) {
          toast({
            title: "No Changes",
            description: "Edit something before resubmitting for review.",
          });
          return;
        }

        // Rejected stays rejected until the author changes something;
        // saving sends it back to peer review, never live directly.
        const draftInput: ContentDraftInput = {
          title: trimmedTitle,
          body: content,
          summary: initialSummary?.trim() || summary?.trim() || null,
          tags,
          imageUrl: finalImageUrl,
          postId: resubmitPostId ?? null,
        };
        try {
          dispatch({ type: "beginUpdate" });
          await resubmitContentDraft({
            variables: { id: resubmitDraftId, input: draftInput },
          });
          await draftRepository.refreshDraftLists(client);
          toast({
            title: "Back in review",
            description: "Your edits are pending. They go live after peer approval.",
          });
          dispatch({ type: "resolveIdle" });
          navigate(`/review/${resubmitDraftId}`);
        } catch (error) {
          toast({
            title: "Resubmit Failed",
            description: getGraphQLErrorMessage(error, "Could not resubmit the draft."),
            variant: "destructive",
          });
          dispatch({ type: "fail", message: "resubmit" });
        } finally {
          isSubmittingRef.current = false;
        }
      } finally {
        isSubmittingRef.current = false;
      }
    },
    [
      post,
      resubmitDraftId,
      resubmitPostId,
      initialSummary,
      title,
      content,
      contentText,
      imageFile,
      imageUrl,
      tags,
      summary,
      uploadCardImage,
      toast,
      resubmitContentDraft,
      client,
      navigate,
    ],
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      if (isResubmit) return handleResubmitSubmit(event);
      if (isEdit) return handleEditSubmit(event);
      return handleCreateSubmit(event);
    },
    [isResubmit, isEdit, handleResubmitSubmit, handleEditSubmit, handleCreateSubmit],
  );

  return { submit, handleSubmit };
};
