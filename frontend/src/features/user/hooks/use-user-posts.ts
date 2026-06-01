import { useState, useMemo } from "react";
import { useQuery } from "@apollo/client/react";
import { MyPostsDocument } from "@/shared/graphql/content-documents";
import { mapPostToBlogCardItem } from "@/entities/post/lib";

export const useUserPosts = (userId: string | undefined, postsPerPage = 3) => {
  const [currentPage, setCurrentPage] = useState(1);

  const { data, loading, error } = useQuery(MyPostsDocument, {
    variables: {
      page: currentPage,
      limit: postsPerPage,
    },
    skip: !userId,
    notifyOnNetworkStatusChange: true,
  });

  const blogs = useMemo(
    () => data?.me?.posts.posts.map(mapPostToBlogCardItem) ?? [],
    [data]
  );

  const totalPages = data?.me?.posts.totalPages ?? 1;
  const totalPosts = data?.me?.posts.totalPosts ?? 0;

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return {
    blogs,
    loading,
    error,
    currentPage,
    totalPages,
    totalPosts,
    handlePageChange,
  };
};
