import { useCallback, useEffect, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";
import { useNavigate } from "react-router-dom";
import { postRepository } from "@/entities/post/api/postRepository";
import { getGraphQLErrorMessage } from "@/shared/api";
import type { PostQuery } from "@/shared/graphql/content-documents";
import { useToast } from "@/shared/ui/hooks/useToast";
import { useSessionStore } from "@/entities/session";
import { markPostViewed } from "./viewed-posts";
import { takeFeedMode } from "./feed-attribution";

// Views are best-effort signal, so they wait a moment before firing and
// never surface errors to the reader.
const VIEW_DEBOUNCE_MS = 1000;

type LoadedPost = NonNullable<PostQuery["post"]>;

export type PostViewerDialog = "closed" | "delete" | "summary";
export type PostViewerView = "reading" | "editing";

export type PostViewerSnapshot =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "not-found" }
  | {
      kind: "ready";
      post: LoadedPost;
      view: PostViewerView;
      dialog: PostViewerDialog;
      isDeleting: boolean;
    };

export interface PostViewerController {
  state: PostViewerSnapshot;
  setView: (view: PostViewerView) => void;
  setDialog: (dialog: PostViewerDialog) => void;
  deletePost: () => Promise<void>;
  refetch: () => Promise<void>;
}

const isValidPostId = (value: string | undefined): boolean => {
  if (value == null) return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  // Accept MongoDB ObjectId (24 hex chars), UUID, or slug-like ids
  const objectIdPattern = /^[a-fA-F0-9]{24}$/;
  const uuidPattern =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  const slugPattern = /^[a-zA-Z0-9_-]+$/;
  if (
    objectIdPattern.test(trimmed) ||
    uuidPattern.test(trimmed) ||
    slugPattern.test(trimmed)
  ) {
    return true;
  }
  return false;
};

export const usePostViewerController = (
  postId: string | undefined,
): PostViewerController => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const client = useApolloClient();
  const [view, setView] = useState<PostViewerView>("reading");
  const [dialog, setDialog] = useState<PostViewerDialog>("closed");
  const isAuthenticated =
    useSessionStore((state) => state.status) === "authenticated";

  const trimmedId = postId?.trim() ?? "";
  const isValidId = isValidPostId(postId);
  const queryId = isValidId ? trimmedId : "";

  const { data, loading, error, refetch, startPolling, stopPolling } =
    postRepository.useGet(queryId);

  const isReady = Boolean(isValidId && data?.post);

  const [recordPostView] = postRepository.useRecordView();

  const isPollingRef = useRef(false);

  useEffect(() => {
    if (!isValidId) {
      if (isPollingRef.current) {
        stopPolling();
        isPollingRef.current = false;
      }
      return;
    }
    if (data?.post?.summaryStatus === "PENDING") {
      if (!isPollingRef.current) {
        startPolling(3000);
        isPollingRef.current = true;
      }
    } else {
      if (isPollingRef.current) {
        stopPolling();
        isPollingRef.current = false;
      }
    }
    return () => {
      if (isPollingRef.current) {
        stopPolling();
        isPollingRef.current = false;
      }
    };
  }, [data?.post?.summaryStatus, isValidId, startPolling, stopPolling]);

  // Report the view once the post has loaded: debounced, once per
  // session per post, and never for anonymous readers (the mutation
  // requires auth). Failures are swallowed on purpose. If the post was
  // opened from the For You feed, the stored feed mode is attached to
  // the view event for engagement measurement.
  useEffect(() => {
    if (!isValidId || !isReady || !isAuthenticated) return;
    const timer = setTimeout(() => {
      if (!markPostViewed(trimmedId)) return;
      void recordPostView({
        variables: { postId: trimmedId, mode: takeFeedMode(trimmedId) ?? undefined },
      }).catch(() => {});
    }, VIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmedId, isValidId, isReady, isAuthenticated, recordPostView]);

  const [deletePost, { loading: isDeleting }] = postRepository.useDelete();

  const handleDelete = async () => {
    if (!isValidId) return;
    try {
      await deletePost({ variables: { id: trimmedId } });
      await postRepository.refreshLists(client, { postId: trimmedId });
      toast({
        title: "Blog Deleted",
        description: "Successfully deleted.",
      });
      navigate("/");
    } catch (err) {
      toast({
        title: "Error",
        description: getGraphQLErrorMessage(err, "Failed to delete post."),
        variant: "destructive",
      });
    } finally {
      setDialog("closed");
    }
  };

  let state: PostViewerSnapshot;
  if (!isValidId) {
    state = { kind: "not-found" };
  } else if (error) {
    state = { kind: "error" };
  } else if (loading && !data) {
    state = { kind: "loading" };
  } else if (!data?.post) {
    state = { kind: "not-found" };
  } else {
    state = {
      kind: "ready",
      post: data.post,
      view,
      dialog,
      isDeleting,
    };
  }

  const handleRefetch = useCallback(async () => {
    try {
      await refetch();
    } catch {
      // Swallow to avoid unhandled rejection; error is exposed via query error field
    }
  }, [refetch]);

  return {
    state,
    setView,
    setDialog,
    deletePost: handleDelete,
    refetch: handleRefetch,
  };
};
