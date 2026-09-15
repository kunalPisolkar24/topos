import { useCallback, useEffect, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";
import { type ContentPostCard, type ContentTag } from "@/shared/graphql/content-documents";
import { DEFAULT_BLOG_CARD_IMAGE, getAuthorDisplayName } from "@/entities/post/lib";
import { tagRepository } from "@/entities/tag";
import { postRepository } from "@/entities/post/api/postRepository";

export type SearchMode = "tags" | "posts";

export interface SearchPostSuggestion {
  id: string;
  title: string;
  imageUrl: string;
  authorName: string;
}

interface UseSearchSuggestionsControllerProps {
  query: string;
  mode: SearchMode;
  isFocused: boolean;
  tagLimit?: number;
  postLimit?: number;
}

export interface SearchSuggestionsState {
  tags: ContentTag[];
  posts: SearchPostSuggestion[];
  totalPosts: number;
  isLoading: boolean;
  debouncedQuery: string;
  error: string | null;
  retry: () => void;
}

const DEBOUNCE_MS = 500;

const toPostSuggestion = (post: ContentPostCard): SearchPostSuggestion => ({
  id: post.id,
  title: post.title,
  imageUrl: post.imageUrl ?? DEFAULT_BLOG_CARD_IMAGE,
  authorName: getAuthorDisplayName(post.author),
});

export const useSearchSuggestionsController = ({
  query,
  mode,
  isFocused,
  tagLimit = 6,
  postLimit = 4,
}: UseSearchSuggestionsControllerProps): SearchSuggestionsState => {
  const client = useApolloClient();
  const requestSequenceRef = useRef(0);
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [tags, setTags] = useState<SearchSuggestionsState["tags"]>([]);
  const [posts, setPosts] = useState<SearchPostSuggestion[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const retry = useCallback(() => {
    setRetryCount((count) => count + 1);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const trimmedQuery = debouncedQuery.trim();

    if (!isFocused || !trimmedQuery) {
      requestSequenceRef.current += 1;
      setTags([]);
      setPosts([]);
      setTotalPosts(0);
      setIsLoading(false);
      setError(null);
      return;
    }

    const requestId = ++requestSequenceRef.current;

    const fetchSuggestions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (mode === "tags") {
          const fetched = await tagRepository.searchTagsOnce(client, {
            query: trimmedQuery,
            limit: tagLimit,
          });

          if (requestId !== requestSequenceRef.current) return;
          setTags(fetched);
          setPosts([]);
          setTotalPosts(0);
          setError(null);
        } else {
          const { data } = await postRepository.searchOnce(client, trimmedQuery, 1, postLimit);

          if (requestId !== requestSequenceRef.current) return;
          const hits: ContentPostCard[] = data?.searchPosts?.hits ?? [];
          setPosts(hits.map(toPostSuggestion));
          setTotalPosts(data?.searchPosts?.total ?? 0);
          setTags([]);
          setError(null);
        }
      } catch (err) {
        if (requestId !== requestSequenceRef.current) return;
        setTags([]);
        setPosts([]);
        setTotalPosts(0);
        const message =
          err instanceof Error && err.message
            ? err.message
            : "Failed to load suggestions. Please try again.";
        setError(message);
      } finally {
        if (requestId === requestSequenceRef.current) {
          setIsLoading(false);
        }
      }
    };

    void fetchSuggestions();
  }, [client, debouncedQuery, isFocused, mode, postLimit, tagLimit, retryCount]);

  return {
    tags,
    posts,
    totalPosts,
    isLoading,
    debouncedQuery,
    error,
    retry,
  };
};
