import React from "react";
import { CommandGroup, CommandItem } from "@/components/ui/command";
import { type SearchPostSuggestion } from "../suggestions";

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
    <CommandGroup
      heading="Post Suggestions"
      className="p-0 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-0.5 [&_[cmdk-group-heading]]:text-[0.75rem] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-[0.18em] [&_[cmdk-group-items]]:space-y-1 sm:[&_[cmdk-group-heading]]:px-4"
    >
      {posts.map((post) => (
        <CommandItem
          key={post.id}
          onSelect={() => onSelect(post.id)}
          value={`post:${post.id}`}
          className="interactive-hover-structural flex cursor-pointer items-center gap-3 rounded-none px-3 py-2 sm:gap-4 sm:px-4 sm:py-2.5"
        >
          <img
            src={post.imageUrl}
            alt={post.title}
            className="h-10 w-16 shrink-0 rounded-none object-cover sm:h-12 sm:w-20"
          />
          <div className="min-w-0">
            <p className="truncate text-[0.97rem] font-medium leading-snug text-foreground sm:text-[1rem]">
              {post.title}
            </p>
            <p className="mt-0.5 font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">
              by {post.authorName}
            </p>
          </div>
        </CommandItem>
      ))}
      {totalPosts > limit && (
        <CommandItem
          onSelect={onSeeAll}
          value="search:see-all"
          className="interactive-hover-structural mt-1 cursor-pointer justify-center rounded-none px-3 py-2 text-center font-mono text-[0.75rem] font-medium uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground sm:px-4"
        >
          See all {totalPosts} results
        </CommandItem>
      )}
    </CommandGroup>
  );
};
