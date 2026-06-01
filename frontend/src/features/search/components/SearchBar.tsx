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
import { type ContentTag } from "@/shared/graphql/content-documents";
import { useSearchSuggestions, type SearchMode } from "../hooks/use-search-suggestions";
import { TagSuggestions } from "./TagSuggestions";
import { PostSuggestions } from "./PostSuggestions";

interface SearchBarProps {
  onTagSelect: (tag: string | null) => void;
  currentFilterTag: string | null;
}

const TAG_SEARCH_LIMIT = 6;
const POST_SEARCH_LIMIT = 4;
const IDLE_COMMAND_VALUE_PREFIX = "__search-idle__";

type InteractionMode = "idle" | "pointer" | "keyboard";

const createIdleCommandValue = (token: number) =>
  `${IDLE_COMMAND_VALUE_PREFIX}-${token}`;

const isKeyboardNavigationKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
  const vimNavigationKey =
    event.ctrlKey && ["j", "k", "n", "p"].includes(event.key.toLowerCase());

  return (
    vimNavigationKey ||
    event.key === "ArrowDown" ||
    event.key === "ArrowUp" ||
    event.key === "Home" ||
    event.key === "End"
  );
};

export const SearchBar: React.FC<SearchBarProps> = ({
  onTagSelect,
  currentFilterTag,
}) => {
  const navigate = useNavigate();
  const commandWrapperRef = useRef<HTMLDivElement>(null);
  const interactionModeRef = useRef<InteractionMode>("idle");
  const idleValueCounterRef = useRef(0);
  const [searchMode, setSearchMode] = useState<SearchMode>("tags");
  const [searchQuery, setSearchQuery] = useState("");
  const [inputIsFocused, setInputIsFocused] = useState(false);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("idle");
  const [activeItemValue, setActiveItemValue] = useState(() =>
    createIdleCommandValue(idleValueCounterRef.current),
  );

  const { tags, posts, totalPosts, isLoading, debouncedQuery } = useSearchSuggestions({
    query: searchQuery,
    mode: searchMode,
    isFocused: inputIsFocused,
    tagLimit: TAG_SEARCH_LIMIT,
    postLimit: POST_SEARCH_LIMIT,
  });

  const resultsSignature =
    searchMode === "tags"
      ? tags.map((tag) => tag.id).join("|")
      : posts.map((post) => post.id).join("|");

  useEffect(() => {
    idleValueCounterRef.current += 1;
    interactionModeRef.current = "idle";
    setInteractionMode("idle");
    setActiveItemValue(createIdleCommandValue(idleValueCounterRef.current));
  }, [debouncedQuery, inputIsFocused, resultsSignature, searchMode, searchQuery, totalPosts]);

  useEffect(() => {
    if (currentFilterTag === null) {
      setSearchQuery("");
    }
  }, [currentFilterTag]);

  const updateInteractionMode = (nextMode: InteractionMode) => {
    if (interactionModeRef.current === nextMode) {
      return;
    }

    interactionModeRef.current = nextMode;
    setInteractionMode(nextMode);
  };

  const resetActiveItem = () => {
    idleValueCounterRef.current += 1;
    updateInteractionMode("idle");
    setActiveItemValue(createIdleCommandValue(idleValueCounterRef.current));
  };

  const handleSelectTag = (tag: ContentTag) => {
    onTagSelect(tag.name);
    setSearchQuery("");
    setInputIsFocused(false);
    resetActiveItem();
    (document.activeElement as HTMLElement | null)?.blur();
  };

  const handleSelectPost = (postId: string) => {
    navigate(`/blog/${postId}`);
    setSearchQuery("");
    setInputIsFocused(false);
    resetActiveItem();
  };

  const handleSeeAllResults = () => {
    const trimmedQuery = debouncedQuery.trim();
    if (trimmedQuery) {
      navigate(`/search?q=${encodeURIComponent(trimmedQuery)}`);
      setInputIsFocused(false);
      resetActiveItem();
    }
  };

  const handleCommandValueChange = (nextValue: string) => {
    if (!nextValue) {
      resetActiveItem();
      return;
    }

    if (interactionModeRef.current === "idle") {
      resetActiveItem();
      return;
    }

    setActiveItemValue(nextValue);
  };

  const handleCommandKeyDownCapture = (
    event: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (!isKeyboardNavigationKey(event)) {
      return;
    }

    updateInteractionMode("keyboard");
  };

  const handleCommandListPointerMoveCapture = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    if (!event.target.closest("[cmdk-item]")) {
      return;
    }

    updateInteractionMode("pointer");
  };

  const handleCommandListPointerLeave = () => {
    if (interactionModeRef.current !== "pointer") {
      return;
    }

    resetActiveItem();
  };

  const showCommandList = inputIsFocused && searchQuery.trim() !== "";
  const noResults = !isLoading && tags.length === 0 && posts.length === 0;

  return (
    <div
      ref={commandWrapperRef}
      className="mx-auto mt-16 w-full max-w-3xl px-4 sm:mt-20 sm:px-6"
    >
      <Card className="gap-0 overflow-hidden rounded-none border-0 bg-surface-lowest py-0 shadow-none">
        <div className="flex items-center gap-0.5 border-b border-outline-variant/20 bg-transparent px-0 py-0">
          <button
            onClick={() => setSearchMode("tags")}
            className={`flex items-center gap-2 px-3 py-2 font-mono text-[0.75rem] font-medium uppercase tracking-[0.16em] focus:outline-none sm:px-3.5 ${
              searchMode === "tags"
                ? "bg-surface-high text-foreground"
                : "text-muted-foreground hover:bg-surface-low hover:text-foreground"
            }`}
          >
            <Hash className="h-3.5 w-3.5" /> Tags
          </button>
          <button
            onClick={() => setSearchMode("posts")}
            className={`flex items-center gap-2 px-3 py-2 font-mono text-[0.75rem] font-medium uppercase tracking-[0.16em] focus:outline-none sm:px-3.5 ${
              searchMode === "posts"
                ? "bg-surface-high text-foreground"
                : "text-muted-foreground hover:bg-surface-low hover:text-foreground"
            }`}
          >
            <BookText className="h-3.5 w-3.5" /> Posts
          </button>
        </div>
        <div className="relative">
          <Command
            shouldFilter={false}
            value={activeItemValue}
            onValueChange={handleCommandValueChange}
            onKeyDownCapture={handleCommandKeyDownCapture}
            className="bg-transparent p-0"
          >
            <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <CommandInput
                showIcon={false}
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
                      resetActiveItem();
                    }
                  }, 150)
                }
                className="flex h-10 w-full rounded-none border-none bg-transparent py-0 text-[0.95rem] text-foreground shadow-none outline-none placeholder:text-muted-foreground sm:h-11"
              />
            </div>
            <CommandList
              data-interaction-mode={interactionMode}
              onPointerMoveCapture={handleCommandListPointerMoveCapture}
              onPointerLeave={handleCommandListPointerLeave}
              className="pb-1"
            >
              {showCommandList && (
                <>
                  {isLoading && (
                    <div className="flex items-center justify-center px-3 py-5 text-sm text-muted-foreground sm:px-4">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      <span>Searching...</span>
                    </div>
                  )}
                  {noResults && (
                    <CommandEmpty className="px-3 py-5 text-center text-sm text-muted-foreground sm:px-4">
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
