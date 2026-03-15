import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookText, Hash, Loader2, Search } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandList,
} from "@/components/ui/command";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { type ContentTag } from "@/graphql/content-documents";
import { useSearchSuggestions, type SearchMode } from "../hooks/use-search-suggestions";
import { TagSuggestions } from "./TagSuggestions";
import { PostSuggestions } from "./PostSuggestions";

interface SearchBarProps {
  onTagSelect: (tag: string | null) => void;
  currentFilterTag: string | null;
}

const TAG_SEARCH_LIMIT = 6;
const POST_SEARCH_LIMIT = 4;

export const SearchBar: React.FC<SearchBarProps> = ({
  onTagSelect,
  currentFilterTag,
}) => {
  const navigate = useNavigate();
  const commandWrapperRef = useRef<HTMLDivElement>(null);
  const [searchMode, setSearchMode] = useState<SearchMode>("tags");
  const [searchQuery, setSearchQuery] = useState("");
  const [inputIsFocused, setInputIsFocused] = useState(false);

  const { tags, posts, totalPosts, isLoading, debouncedQuery } = useSearchSuggestions({
    query: searchQuery,
    mode: searchMode,
    isFocused: inputIsFocused,
    tagLimit: TAG_SEARCH_LIMIT,
    postLimit: POST_SEARCH_LIMIT,
  });

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
    const trimmedQuery = debouncedQuery.trim();
    if (trimmedQuery) {
      navigate(`/search?q=${encodeURIComponent(trimmedQuery)}`);
      setInputIsFocused(false);
    }
  };

  const showCommandList = inputIsFocused && searchQuery.trim() !== "";
  const noResults = !isLoading && tags.length === 0 && posts.length === 0;

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
                      No results found for "{debouncedQuery}".
                    </CommandEmpty>
                  )}
                  {searchMode === "tags" && (
                    <TagSuggestions tags={tags} onSelect={handleSelectTag} />
                  )}
                  {searchMode === "posts" && (
                    <PostSuggestions
                      posts={posts}
                      totalPosts={totalPosts}
                      limit={POST_SEARCH_LIMIT}
                      onSelect={handleSelectPost}
                      onSeeAll={handleSeeAllResults}
                    />
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
