import React from "react";
import { CommandGroup, CommandItem } from "@/components/ui/command";
import { type SearchPostSuggestion } from "@/features/blog/hooks/use-search-suggestions";

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
      {totalPosts > limit && (
        <CommandItem
          onSelect={onSeeAll}
          className="cursor-pointer justify-center text-center text-zinc-300 hover:text-zinc-100 focus:bg-zinc-800"
        >
          See all {totalPosts} results
        </CommandItem>
      )}
    </CommandGroup>
  );
};
