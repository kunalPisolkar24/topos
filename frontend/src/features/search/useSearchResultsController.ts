import { useMemo } from "react";
import { postRepository } from "@/entities/post/api/postRepository";
import {
  buildSearchPagination,
  mapPostToBlogCardItem,
  type BlogCardItem,
} from "@/entities/post/lib";
import type { SearchPostsQuery } from "@/shared/graphql/content-documents";

export interface SearchResultsController {
  results: BlogCardItem[];
  paginationInfo: {
    currentPage: number;
    totalPages: number;
    totalResults: number;
  };
  loading: boolean;
  error: unknown;
  data: SearchPostsQuery | undefined;
}

export const useSearchResultsController = (
  query: string,
  page: number,
  pageSize = 6,
): SearchResultsController => {
  const { data, loading, error } = postRepository.useSearch(query, page, pageSize);

  const results = useMemo(
    () => data?.searchPosts?.hits.map(mapPostToBlogCardItem) ?? [],
    [data],
  );

  const paginationInfo = useMemo(
    () =>
      buildSearchPagination(
        data?.searchPosts?.total ?? 0,
        page,
        pageSize,
      ),
    [data, page, pageSize],
  );

  return {
    results,
    paginationInfo,
    loading,
    error,
    data,
  };
};
