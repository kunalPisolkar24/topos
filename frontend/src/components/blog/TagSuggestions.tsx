import React from "react";
import { Hash } from "lucide-react";
import { CommandGroup, CommandItem } from "@/components/ui/command";
import { type ContentTag } from "@/graphql/content-documents";

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
          className="cursor-pointer"
        >
          <Hash className="mr-2 h-3 w-3" /> {tag.name}
        </CommandItem>
      ))}
    </CommandGroup>
  );
};
