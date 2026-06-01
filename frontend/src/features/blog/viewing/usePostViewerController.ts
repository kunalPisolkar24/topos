import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { useNavigate } from "react-router-dom";
import {
  DeletePostDocument,
  PostDocument,
  type PostQuery,
  type PostQueryVariables,
} from "@/shared/graphql/content-documents";
import { getGraphQLErrorMessage } from "@/shared/api";
import { useToast } from "@/shared/ui/hooks/useToast";

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
  refetch: () => void;
}

const REFETCH_POST_LISTS = ["Posts", "PostsByTag", "MyPosts", "SearchPosts"];

export const usePostViewerController = (
  postId: string | undefined,
): PostViewerController => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [view, setView] = useState<PostViewerView>("reading");
  const [dialog, setDialog] = useState<PostViewerDialog>("closed");

  const { data, loading, error, refetch, startPolling, stopPolling } =
    useQuery<PostQuery, PostQueryVariables>(PostDocument, {
      variables: { id: postId ?? "" },
      skip: !postId,
      notifyOnNetworkStatusChange: true,
    });

  useEffect(() => {
    if (data?.post?.summaryStatus === "PENDING") {
      startPolling(3000);
    } else {
      stopPolling();
    }
    return () => stopPolling();
  }, [data?.post?.summaryStatus, startPolling, stopPolling]);

  const [deletePost, { loading: isDeleting }] = useMutation(
    DeletePostDocument,
    { refetchQueries: REFETCH_POST_LISTS },
  );

  useEffect(() => {
    if (!error) return;
    toast({
      title: "Error",
      description: "Could not load blog post.",
      variant: "destructive",
    });
    navigate("/");
  }, [error, navigate, toast]);

  const handleDelete = async () => {
    if (!postId) return;
    try {
      await deletePost({ variables: { id: postId } });
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
  if (error) {
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

  return {
    state,
    setView,
    setDialog,
    deletePost: handleDelete,
    refetch: () => {
      void refetch();
    },
  };
};
