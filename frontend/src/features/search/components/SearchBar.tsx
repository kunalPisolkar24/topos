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
      <Card className="overflow-hidden rounded-none border border-outline-variant/20 bg-surface-lowest shadow-none">
        <div className="flex items-center gap-1 border-b border-outline-variant/20 bg-transparent p-1.5 px-2">
          <button
            onClick={() => setSearchMode("tags")}
            className={`flex items-center gap-2 px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.05em] focus:outline-none ${
              searchMode === "tags"
                ? "bg-surface-high text-foreground"
                : "text-muted-foreground hover:bg-surface-low hover:text-foreground"
            }`}
          >
            <Hash className="h-3.5 w-3.5" /> Tags
          </button>
          <button
            onClick={() => setSearchMode("posts")}
            className={`flex items-center gap-2 px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.05em] focus:outline-none ${
              searchMode === "posts"
                ? "bg-surface-high text-foreground"
                : "text-muted-foreground hover:bg-surface-low hover:text-foreground"
            }`}
          >
            <BookText className="h-3.5 w-3.5" /> Posts
          </button>
        </div>
        <div className="relative">
          <Command shouldFilter={false} className="bg-transparent">
            <div className="flex items-center px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
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
                className="flex h-12 w-full rounded-none bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <CommandList>
              {showCommandList && (
                <>
                  {isLoading && (
                    <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      <span>Searching...</span>
                    </div>
                  )}
                  {noResults && (
                    <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
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
