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
    <CommandGroup heading="Tag Suggestions">
      {tags.map((tag) => (
        <CommandItem
          key={tag.id}
          onSelect={() => onSelect(tag)}
          value={tag.name}
          className="interactive-hover-structural mb-1.5 cursor-pointer rounded-none px-3 py-2"
        >
          <span className="font-mono text-[0.75rem] font-medium uppercase tracking-[0.16em] text-primary">
            {formatBlogCardTag(tag.name)}
          </span>
        </CommandItem>
      ))}
    </CommandGroup>
  );
};
