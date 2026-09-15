import { useMemo, useState } from "react";
import { userRepository } from "@/entities/user/api/userRepository";
import {
  mapPostToBlogCardItem,
  type BlogCardItem,
} from "@/features/blog/presenters/blog-card-presenter";

export interface UseUserPostsControllerProps {
  userId: string | undefined;
  postsPerPage?: number;
}

export interface UserPostsState {
  blogs: BlogCardItem[];
  loading: boolean;
  currentPage: number;
  totalPages: number;
  totalPosts: number;
}

export interface UserPostsController {
  state: UserPostsState;
  handlePageChange: (page: number) => void;
}

export const useUserPostsController = ({
  userId,
  postsPerPage = 3,
}: UseUserPostsControllerProps): UserPostsController => {
  const [currentPage, setCurrentPage] = useState(1);

  const { data, loading } = userRepository.useMyPosts(currentPage, postsPerPage, { skip: !userId });

  const blogs = useMemo<BlogCardItem[]>(
    () => data?.me?.posts?.posts.map(mapPostToBlogCardItem) ?? [],
    [data],
  );

  const totalPages = data?.me?.posts?.totalPages ?? 1;
  const totalPosts = data?.me?.posts?.totalPosts ?? 0;

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return {
    state: {
      blogs,
      loading,
      currentPage,
      totalPages,
      totalPosts,
    },
    handlePageChange,
  };
};
