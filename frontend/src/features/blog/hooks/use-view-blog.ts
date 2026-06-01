import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@apollo/client/react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  PostDocument, 
  DeletePostDocument 
} from "@/graphql/content-documents";
import { useToast } from "@/hooks/use-toast";
import { getGraphQLErrorMessage } from "@/shared/api";

export const useViewBlog = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = useState(false);

  const { data, loading, error, refetch, startPolling, stopPolling } = useQuery(PostDocument, {
    variables: { id: id ?? "" },
    skip: !id,
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

  const [deletePost, { loading: isDeleting }] = useMutation(DeletePostDocument, {
    refetchQueries: ["Posts", "PostsByTag", "MyPosts", "SearchPosts"],
  });

  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: "Could not load blog post.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [error, navigate, toast]);

  const confirmDelete = async () => {
    if (!id) return;
    try {
      await deletePost({ variables: { id } });
      toast({ title: "Blog Deleted", description: "Successfully deleted." });
      navigate("/");
    } catch (err) {
      toast({
        title: "Error",
        description: getGraphQLErrorMessage(err, "Failed to delete post."),
        variant: "destructive",
      });
    } finally {
      setIsDeleteDialogOpen(false);
    }
  };

  return {
    blog: data?.post ?? null,
    loading,
    error,
    isEditing,
    setIsEditing,
    isDeleting,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    isSummaryDialogOpen,
    setIsSummaryDialogOpen,
    confirmDelete,
    refetch,
  };
};
