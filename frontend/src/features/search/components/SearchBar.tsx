import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookText, Hash, Loader2, Search } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandList,
} from "@/shared/ui/primitives/command";
import { Card } from "@/shared/ui/primitives/card";
import { type ContentTag } from "@/shared/graphql/content-documents";
import { useSearchSuggestionsController, type SearchMode } from "../suggestions";
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
  const blurTimeoutRef = useRef<number | null>(null);
  const [searchMode, setSearchMode] = useState<SearchMode>("tags");
  const [searchQuery, setSearchQuery] = useState("");
  const [inputIsFocused, setInputIsFocused] = useState(false);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("idle");
  const [activeItemValue, setActiveItemValue] = useState(() =>
    createIdleCommandValue(idleValueCounterRef.current),
  );

  const { tags, posts, totalPosts, isLoading, debouncedQuery, error, retry } =
    useSearchSuggestionsController({
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

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current !== null) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

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
  const hasError = Boolean(error);
  const noResults = !isLoading && !hasError && tags.length === 0 && posts.length === 0;

  const tagsTabId = "search-tab-tags";
  const postsTabId = "search-tab-posts";
  const panelId = "search-panel";

  const handleTabsKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.getAttribute("role") !== "tab") return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      setSearchMode((prev) => (prev === "tags" ? "posts" : "tags"));
      const nextId = target.id === tagsTabId ? postsTabId : tagsTabId;
      document.getElementById(nextId)?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      setSearchMode("tags");
      document.getElementById(tagsTabId)?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      setSearchMode("posts");
      document.getElementById(postsTabId)?.focus();
    }
  };

  return (
    <div
      ref={commandWrapperRef}
      className="mx-auto mt-6 w-full max-w-2xl px-4 sm:mt-8 sm:px-5"
    >
      <Card className="gap-0 overflow-hidden rounded-none border border-outline-variant/20 bg-surface-lowest py-0 shadow-none">
        <div
          role="tablist"
          aria-label="Search mode"
          onKeyDown={handleTabsKeyDown}
          className="flex items-center gap-0.5 bg-surface-low px-0 py-0"
        >
          <button
            id={tagsTabId}
            type="button"
            role="tab"
            aria-selected={searchMode === "tags"}
            aria-controls={panelId}
            tabIndex={searchMode === "tags" ? 0 : -1}
            onClick={() => setSearchMode("tags")}
            className={
              searchMode === "tags"
                ? "flex items-center gap-1.5 bg-primary-container px-2.5 py-1.5 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-primary-foreground focus:outline-none focus-visible:bg-primary-container sm:px-3"
                : "flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-muted-foreground hover:bg-surface-high hover:text-foreground focus:outline-none focus-visible:bg-primary-container sm:px-3"
            }
          >
            <Hash className="h-3 w-3" /> Tags
          </button>
          <button
            id={postsTabId}
            type="button"
            role="tab"
            aria-selected={searchMode === "posts"}
            aria-controls={panelId}
            tabIndex={searchMode === "posts" ? 0 : -1}
            onClick={() => setSearchMode("posts")}
            className={
              searchMode === "posts"
                ? "flex items-center gap-1.5 bg-primary-container px-2.5 py-1.5 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-primary-foreground focus:outline-none focus-visible:bg-primary-container sm:px-3"
                : "flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-muted-foreground hover:bg-surface-high hover:text-foreground focus:outline-none focus-visible:bg-primary-container sm:px-3"
            }
          >
            <BookText className="h-3 w-3" /> Posts
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
            <div className="flex items-center gap-2 px-3 py-2 sm:px-3">
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
                onFocus={() => {
                  if (blurTimeoutRef.current !== null) {
                    clearTimeout(blurTimeoutRef.current);
                    blurTimeoutRef.current = null;
                  }
                  setInputIsFocused(true);
                }}
                onBlur={() => {
                  if (blurTimeoutRef.current !== null) {
                    clearTimeout(blurTimeoutRef.current);
                  }
                  blurTimeoutRef.current = window.setTimeout(() => {
                    if (
                      commandWrapperRef.current &&
                      !commandWrapperRef.current.contains(document.activeElement)
                    ) {
                      setInputIsFocused(false);
                      resetActiveItem();
                    }
                    blurTimeoutRef.current = null;
                  }, 150);
                }}
                className="flex h-9 w-full rounded-none border-none bg-transparent py-0 text-[0.875rem] text-foreground shadow-none outline-none placeholder:text-muted-foreground sm:h-9"
              />
            </div>
            <CommandList
              id={panelId}
              role="tabpanel"
              aria-labelledby={searchMode === "tags" ? tagsTabId : postsTabId}
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
                  {hasError && !isLoading && (
                    <div
                      className="px-3 py-5 text-center text-sm text-destructive sm:px-4"
                      role="alert"
                    >
                      <p>{error}</p>
                      <button
                        type="button"
                        onClick={retry}
                        className="mt-2 text-xs font-medium underline underline-offset-4 hover:text-destructive/80"
                      >
                        Retry
                      </button>
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
