import React, { useEffect, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";
import { useNavigate } from "react-router-dom";
import { BookText, Hash, Loader2, Search } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  SearchPostsDocument,
  TagsDocument,
  type ContentTag,
} from "@/graphql/content-documents";
import { DEFAULT_BLOG_CARD_IMAGE, getAuthorDisplayName } from "@/lib/content";

interface SearchBarProps {
  onTagSelect: (tag: string | null) => void;
  currentFilterTag: string | null;
}

interface SearchPostSuggestion {
  id: string;
  title: string;
  imageUrl: string;
  authorName: string;
}

const TAG_SEARCH_LIMIT = 6;
const POST_SEARCH_LIMIT = 4;

export const SearchBar: React.FC<SearchBarProps> = ({
  onTagSelect,
  currentFilterTag,
}) => {
  const client = useApolloClient();
  const navigate = useNavigate();
  const commandWrapperRef = useRef<HTMLDivElement>(null);
  const requestSequenceRef = useRef(0);
  const [searchMode, setSearchMode] = useState<"tags" | "posts">("tags");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
  const [tagsToShow, setTagsToShow] = useState<ContentTag[]>([]);
  const [postsToShow, setPostsToShow] = useState<SearchPostSuggestion[]>([]);
  const [totalPostResults, setTotalPostResults] = useState(0);
  const [isTagsLoading, setIsTagsLoading] = useState(false);
  const [isPostsLoading, setIsPostsLoading] = useState(false);
  const [inputIsFocused, setInputIsFocused] = useState(false);

  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);

    return () => clearTimeout(timerId);
  }, [searchQuery]);

  useEffect(() => {
    const trimmedQuery = debouncedSearchQuery.trim();

    if (!inputIsFocused || !trimmedQuery) {
      requestSequenceRef.current += 1;
      setTagsToShow([]);
      setPostsToShow([]);
      setTotalPostResults(0);
      setIsTagsLoading(false);
      setIsPostsLoading(false);
      return;
    }

    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;

    const fetchData = async () => {
      if (searchMode === "tags") {
        setIsTagsLoading(true);
        setPostsToShow([]);
        setTotalPostResults(0);

        try {
          const { data } = await client.query({
            query: TagsDocument,
            variables: {
              query: trimmedQuery,
              limit: TAG_SEARCH_LIMIT,
            },
            fetchPolicy: "no-cache",
          });

          if (requestSequenceRef.current !== requestId) {
            return;
          }

          setTagsToShow(data.tags);
        } catch (error) {
          if (requestSequenceRef.current !== requestId) {
            return;
          }

          setTagsToShow([]);
          console.error("Error fetching tags:", error);
        } finally {
          if (requestSequenceRef.current === requestId) {
            setIsTagsLoading(false);
          }
        }

        return;
      }

      setIsPostsLoading(true);
      setTagsToShow([]);

      try {
        const { data } = await client.query({
          query: SearchPostsDocument,
          variables: {
            query: trimmedQuery,
            limit: POST_SEARCH_LIMIT,
            page: 1,
          },
          fetchPolicy: "no-cache",
        });

        if (requestSequenceRef.current !== requestId) {
          return;
        }

        setPostsToShow(
          data.searchPosts.hits.map((post) => ({
            id: post.id,
            title: post.title,
            imageUrl: post.imageUrl || DEFAULT_BLOG_CARD_IMAGE,
            authorName: getAuthorDisplayName(post.author),
          })),
        );
        setTotalPostResults(data.searchPosts.total);
      } catch (error) {
        if (requestSequenceRef.current !== requestId) {
          return;
        }

        setPostsToShow([]);
        setTotalPostResults(0);
        console.error("Error fetching search results:", error);
      } finally {
        if (requestSequenceRef.current === requestId) {
          setIsPostsLoading(false);
        }
      }
    };

    void fetchData();
  }, [client, debouncedSearchQuery, inputIsFocused, searchMode]);

  useEffect(() => {
    if (currentFilterTag === null) {
      setSearchQuery("");
    }
  }, [currentFilterTag]);

  const handleSelectTag = (tag: ContentTag) => {
    onTagSelect(tag.name);
    setSearchQuery("");
    setInputIsFocused(false);
    (document.activeElement as HTMLElement | null)?.blur();
  };

  const handleSelectPost = (postId: string) => {
    navigate(`/blog/${postId}`);
    setSearchQuery("");
    setInputIsFocused(false);
  };

  const handleSeeAllResults = () => {
    const trimmedQuery = debouncedSearchQuery.trim();

    if (trimmedQuery) {
      navigate(`/search?q=${encodeURIComponent(trimmedQuery)}`);
      setInputIsFocused(false);
    }
  };

  const showCommandList = inputIsFocused && searchQuery.trim() !== "";
  const isLoading = isTagsLoading || isPostsLoading;
  const noResults =
    !isLoading && tagsToShow.length === 0 && postsToShow.length === 0;

  return (
    <div
      ref={commandWrapperRef}
      className="mx-auto mt-16 w-full max-w-3xl px-4 sm:mt-20 sm:px-6"
    >
      <Card className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-lg">
        <div className="flex items-center gap-1 border-b border-zinc-800 bg-zinc-900/30 p-2">
          <Button
            variant={searchMode === "tags" ? "secondary" : "ghost"}
            onClick={() => setSearchMode("tags")}
            className="h-8 px-3 text-sm"
          >
            <Hash className="mr-2 h-4 w-4" /> Tags
          </Button>
          <Button
            variant={searchMode === "posts" ? "secondary" : "ghost"}
            onClick={() => setSearchMode("posts")}
            className="h-8 px-3 text-sm"
          >
            <BookText className="mr-2 h-4 w-4" /> Posts
          </Button>
        </div>
        <div className="relative">
          <Command shouldFilter={false} className="bg-transparent">
            <div className="flex items-center px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 text-zinc-400" />
              <CommandInput
                placeholder={
                  searchMode === "tags"
                    ? "Search tags..."
                    : "Search post titles & content..."
                }
                value={searchQuery}
                onValueChange={setSearchQuery}
                onFocus={() => setInputIsFocused(true)}
                onBlur={() =>
                  setTimeout(() => {
                    if (
                      commandWrapperRef.current &&
                      !commandWrapperRef.current.contains(document.activeElement)
                    ) {
                      setInputIsFocused(false);
                    }
                  }, 150)
                }
                className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
              />
            </div>
            <CommandList>
              {showCommandList && (
                <>
                  {isLoading && (
                    <div className="flex items-center justify-center py-6 text-sm text-zinc-400">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      <span>Searching...</span>
                    </div>
                  )}
                  {noResults && (
                    <CommandEmpty className="py-6 text-center text-sm text-zinc-400">
                      No results found for "{debouncedSearchQuery}".
                    </CommandEmpty>
                  )}
                  {!isTagsLoading &&
                    searchMode === "tags" &&
                    tagsToShow.length > 0 && (
                      <CommandGroup heading="Tag Suggestions">
                        {tagsToShow.map((tag) => (
                          <CommandItem
                            key={tag.id}
                            onSelect={() => handleSelectTag(tag)}
                            value={tag.name}
                            className="cursor-pointer"
                          >
                            <Hash className="mr-2 h-3 w-3" /> {tag.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  {!isPostsLoading &&
                    searchMode === "posts" &&
                    postsToShow.length > 0 && (
                      <CommandGroup heading="Post Suggestions">
                        {postsToShow.map((post) => (
                          <CommandItem
                            key={post.id}
                            onSelect={() => handleSelectPost(post.id)}
                            className="flex cursor-pointer items-center gap-3 p-2"
                          >
                            <img
                              src={post.imageUrl}
                              alt={post.title}
                              className="h-10 w-16 flex-shrink-0 rounded-md object-cover"
                            />
                            <div className="overflow-hidden">
                              <p className="truncate text-sm font-medium text-zinc-100">
                                {post.title}
                              </p>
                              <p className="text-xs text-zinc-400">
                                by {post.authorName}
                              </p>
                            </div>
                          </CommandItem>
                        ))}
                        {totalPostResults > POST_SEARCH_LIMIT && (
                          <CommandItem
                            onSelect={handleSeeAllResults}
                            className="cursor-pointer justify-center text-center text-zinc-300 hover:text-zinc-100 focus:bg-zinc-800"
                          >
                            See all {totalPostResults} results
                          </CommandItem>
                        )}
                      </CommandGroup>
                    )}
                </>
              )}
            </CommandList>
          </Command>
        </div>
      </Card>
    </div>
  );
};
