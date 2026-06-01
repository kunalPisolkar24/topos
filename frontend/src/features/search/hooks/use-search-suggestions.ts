import { useState, useEffect, useRef } from "react";
import { useApolloClient } from "@apollo/client/react";
import {
  SearchPostsDocument,
  TagsDocument,
  type ContentTag,
} from "@/shared/graphql/content-documents";
import { DEFAULT_BLOG_CARD_IMAGE, getAuthorDisplayName } from "@/lib/content";

export type SearchMode = "tags" | "posts";

export interface SearchPostSuggestion {
  id: string;
  title: string;
  imageUrl: string;
  authorName: string;
}

interface UseSearchSuggestionsProps {
  query: string;
  mode: SearchMode;
  isFocused: boolean;
  tagLimit?: number;
  postLimit?: number;
}

export const useSearchSuggestions = ({
  query,
  mode,
  isFocused,
  tagLimit = 6,
  postLimit = 4,
}: UseSearchSuggestionsProps) => {
  const client = useApolloClient();
  const requestSequenceRef = useRef(0);
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [tags, setTags] = useState<ContentTag[]>([]);
  const [posts, setPosts] = useState<SearchPostSuggestion[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 500);
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
          const { data } = await client.query({
            query: TagsDocument,
            variables: { query: trimmedQuery, limit: tagLimit },
            fetchPolicy: "no-cache",
          });

          if (requestId !== requestSequenceRef.current) return;
          setTags(data?.tags ?? []);
          setPosts([]);
          setTotalPosts(0);
        } else {
          const { data } = await client.query({
            query: SearchPostsDocument,
            variables: { query: trimmedQuery, limit: postLimit, page: 1 },
            fetchPolicy: "no-cache",
          });

          if (requestId !== requestSequenceRef.current) return;
          const hits = data?.searchPosts?.hits ?? [];
          setPosts(hits.map((post: any) => ({
            id: post.id,
            title: post.title,
            imageUrl: post.imageUrl || DEFAULT_BLOG_CARD_IMAGE,
            authorName: getAuthorDisplayName(post.author),
          })));
          setTotalPosts(data?.searchPosts?.total ?? 0);
          setTags([]);
        }
      } catch (error) {
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

    fetchSuggestions();
  }, [client, debouncedQuery, isFocused, mode, tagLimit, postLimit]);

  return {
    tags,
    posts,
    totalPosts,
    isLoading,
    debouncedQuery,
  };
};
