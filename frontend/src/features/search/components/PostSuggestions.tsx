import React from "react";
import { CommandGroup, CommandItem } from "@/components/ui/command";
import { type SearchPostSuggestion } from "../hooks/use-search-suggestions";

interface PostSuggestionsProps {
  posts: SearchPostSuggestion[];
  totalPosts: number;
  limit: number;
  onSelect: (id: string) => void;
  onSeeAll: () => void;
}

export const PostSuggestions: React.FC<PostSuggestionsProps> = ({
  posts,
  totalPosts,
  limit,
  onSelect,
  onSeeAll,
}) => {
  if (posts.length === 0) return null;

  return (
    <CommandGroup heading="Post Suggestions">
      {posts.map((post) => (
        <CommandItem
          key={post.id}
          onSelect={() => onSelect(post.id)}
          className="interactive-hover-structural mb-1.5 flex cursor-pointer items-center gap-4 rounded-none px-3 py-2.5"
        >
          <img
            src={post.imageUrl}
            alt={post.title}
            className="h-12 w-20 shrink-0 rounded-none object-cover"
          />
          <div className="min-w-0">
            <p className="truncate text-[0.9rem] font-medium leading-snug text-foreground">
              {post.title}
            </p>
            <p className="mt-0.5 font-mono text-[0.6875rem] uppercase tracking-[0.05em] text-muted-foreground">
              by {post.authorName}
            </p>
          </div>
        </CommandItem>
      ))}
      {totalPosts > limit && (
        <CommandItem
          onSelect={onSeeAll}
          className="mt-1 cursor-pointer justify-center rounded-none text-center font-mono text-[0.75rem] uppercase tracking-[0.05em] text-muted-foreground hover:text-foreground"
        >
          See all {totalPosts} results
        </CommandItem>
      )}
    </CommandGroup>
  );
};
