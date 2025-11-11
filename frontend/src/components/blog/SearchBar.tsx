import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Hash, Search, Loader2, BookText } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Tag {
  id: number;
  name: string;
}

interface PostSearchResult {
  postId: number;
  title: string;
  authorName: string;
  imageUrl: string | null;
  createdAt: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalResults: number;
}

interface SearchBarProps {
  onTagSelect: (tag: string | null) => void;
  currentFilterTag: string | null;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onTagSelect, currentFilterTag }) => {
  const [searchMode, setSearchMode] = useState<"tags" | "posts">("tags");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);

  const [tagsToShow, setTagsToShow] = useState<Tag[]>([]);
  const [isTagsLoading, setIsTagsLoading] = useState(false);

  const [postsToShow, setPostsToShow] = useState<PostSearchResult[]>([]);
  const [postsPagination, setPostsPagination] = useState<PaginationInfo | null>(null);
  const [isPostsLoading, setIsPostsLoading] = useState(false);

  const [inputIsFocused, setInputIsFocused] = useState(false);
  const commandWrapperRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);

    return () => clearTimeout(timerId);
  }, [searchQuery]);

  useEffect(() => {
    const fetchData = async () => {
      if (!inputIsFocused || !debouncedSearchQuery.trim()) {
        setTagsToShow([]);
        setPostsToShow([]);
        return;
      }

      if (searchMode === "tags") {
        setIsTagsLoading(true);
        try {
          const response = await axios.get<Tag[]>(
            `${import.meta.env.VITE_BACKEND_URL}/api/tags?query=${encodeURIComponent(debouncedSearchQuery.trim())}`
          );
          setTagsToShow(response.data);
        } catch (error) {
          console.error("Error fetching tags:", error);
        } finally {
          setIsTagsLoading(false);
        }
      } else {
        setIsPostsLoading(true);
        try {
          const response = await axios.get(
            `${import.meta.env.VITE_BACKEND_URL}/api/search?q=${encodeURIComponent(debouncedSearchQuery.trim())}&limit=4`
          );
          setPostsToShow(response.data.data);
          setPostsPagination(response.data.pagination);
        } catch (error) {
          console.error("Error fetching search results:", error);
          setPostsToShow([]);
        } finally {
          setIsPostsLoading(false);
        }
      }
    };

    fetchData();
  }, [debouncedSearchQuery, inputIsFocused, searchMode]);

  useEffect(() => {
    if (currentFilterTag === null) {
      setSearchQuery("");
    }
  }, [currentFilterTag]);

  const handleSelectTag = (tag: Tag) => {
    onTagSelect(tag.name);
    setSearchQuery("");
    setInputIsFocused(false);
    (document.activeElement as HTMLElement)?.blur();
  };

  const handleSelectPost = (postId: number) => {
    navigate(`/blog/${postId}`);
    setSearchQuery("");
    setInputIsFocused(false);
  };

  const handleSeeAllResults = () => {
    if (debouncedSearchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(debouncedSearchQuery.trim())}`);
      setInputIsFocused(false);
    }
  };

  const showCommandList = inputIsFocused && searchQuery.trim() !== "";
  const isLoading = isTagsLoading || isPostsLoading;
  const noResults = !isLoading && tagsToShow.length === 0 && postsToShow.length === 0;

  return (
    <div ref={commandWrapperRef} className="w-full max-w-3xl mx-auto px-4 sm:px-6 mt-16 sm:mt-20">
      <Card className="border border-zinc-800 bg-zinc-950 shadow-lg rounded-xl overflow-hidden">
        <div className="flex items-center gap-1 p-2 border-b border-zinc-800 bg-zinc-900/30">
          <Button
            variant={searchMode === 'tags' ? 'secondary' : 'ghost'}
            onClick={() => setSearchMode('tags')}
            className="h-8 px-3 text-sm"
          >
            <Hash className="mr-2 h-4 w-4" /> Tags
          </Button>
          <Button
            variant={searchMode === 'posts' ? 'secondary' : 'ghost'}
            onClick={() => setSearchMode('posts')}
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
                placeholder={searchMode === 'tags' ? "Search tags..." : "Search post titles & content..."}
                value={searchQuery}
                onValueChange={setSearchQuery}
                onFocus={() => setInputIsFocused(true)}
                onBlur={() => setTimeout(() => {
                  if (commandWrapperRef.current && !commandWrapperRef.current.contains(document.activeElement)) {
                    setInputIsFocused(false);
                  }
                }, 150)}
                className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-zinc-500 text-zinc-100"
              />
            </div>
            <CommandList>
              {showCommandList && (
                <>
                  {isLoading && (
                    <div className="flex items-center justify-center py-6 text-sm text-zinc-400">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      <span>Searching...</span>
                    </div>
                  )}
                  {noResults && (
                    <CommandEmpty className="py-6 text-center text-sm text-zinc-400">
                      No results found for "{debouncedSearchQuery}".
                    </CommandEmpty>
                  )}
                  {!isTagsLoading && searchMode === 'tags' && tagsToShow.length > 0 && (
                    <CommandGroup heading="Tag Suggestions">
                      {tagsToShow.map((tag) => (
                        <CommandItem key={tag.id} onSelect={() => handleSelectTag(tag)} value={tag.name} className="cursor-pointer">
                          <Hash className="mr-2 h-3 w-3" /> {tag.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                  {!isPostsLoading && searchMode === 'posts' && postsToShow.length > 0 && (
                    <CommandGroup heading="Post Suggestions">
                      {postsToShow.map(post => (
                        <CommandItem key={post.postId} onSelect={() => handleSelectPost(post.postId)} className="cursor-pointer flex items-center gap-3 p-2">
                          <img
                            src={post.imageUrl || 'https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&w=100&q=80'}
                            alt={post.title}
                            className="w-16 h-10 object-cover rounded-md flex-shrink-0"
                          />
                          <div className="overflow-hidden">
                            <p className="font-medium text-zinc-100 truncate text-sm">{post.title}</p>
                            <p className="text-xs text-zinc-400">by {post.authorName}</p>
                          </div>
                        </CommandItem>
                      ))}
                      {postsPagination && postsPagination.totalResults > 4 && (
                        <CommandItem onSelect={handleSeeAllResults} className="justify-center text-center cursor-pointer text-zinc-300 hover:text-zinc-100 focus:bg-zinc-800">
                          See all {postsPagination.totalResults} results
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