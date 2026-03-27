import React from "react";
import { CommandGroup, CommandItem } from "@/components/ui/command";
import { type ContentTag } from "@/graphql/content-documents";
import { formatBlogCardTag } from "@/lib/content";

interface TagSuggestionsProps {
  tags: ContentTag[];
  onSelect: (tag: ContentTag) => void;
}

export const TagSuggestions: React.FC<TagSuggestionsProps> = ({ tags, onSelect }) => {
  if (tags.length === 0) return null;

  return (
    <CommandGroup
      heading="Tag Suggestions"
      className="p-0 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-0.5 [&_[cmdk-group-heading]]:text-[0.75rem] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-[0.18em] [&_[cmdk-group-items]]:space-y-1 sm:[&_[cmdk-group-heading]]:px-4"
    >
      {tags.map((tag) => (
        <CommandItem
          key={tag.id}
          onSelect={() => onSelect(tag)}
          value={`tag:${tag.id}`}
          className="interactive-hover-structural cursor-pointer rounded-none px-3 py-2 sm:px-4"
        >
          <span className="font-mono text-[0.8125rem] font-medium uppercase tracking-[0.18em] text-primary">
            {formatBlogCardTag(tag.name)}
          </span>
        </CommandItem>
      ))}
    </CommandGroup>
  );
};
