import { useEffect, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";
import {
  SearchPostsDocument,
  type ContentPostCard,
  type ContentTag,
} from "@/shared/graphql/content-documents";
import { DEFAULT_BLOG_CARD_IMAGE, getAuthorDisplayName } from "@/entities/post/lib";
import { tagRepository } from "@/entities/tag";

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
      return;
    }

    const requestId = ++requestSequenceRef.current;

    const fetchSuggestions = async () => {
      setIsLoading(true);
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
        } else {
          const { data } = await client.query({
            query: SearchPostsDocument,
            variables: { query: trimmedQuery, limit: postLimit, page: 1 },
            fetchPolicy: "no-cache",
          });

          if (requestId !== requestSequenceRef.current) return;
          const hits: ContentPostCard[] = data?.searchPosts?.hits ?? [];
          setPosts(hits.map(toPostSuggestion));
          setTotalPosts(data?.searchPosts?.total ?? 0);
          setTags([]);
        }
      } catch {
        if (requestId !== requestSequenceRef.current) return;
        setTags([]);
        setPosts([]);
        setTotalPosts(0);
      } finally {
        if (requestId === requestSequenceRef.current) {
          setIsLoading(false);
        }
      }
    };

    void fetchSuggestions();
  }, [client, debouncedQuery, isFocused, mode, postLimit, tagLimit]);

  return {
    tags,
    posts,
    totalPosts,
    isLoading,
    debouncedQuery,
  };
};
