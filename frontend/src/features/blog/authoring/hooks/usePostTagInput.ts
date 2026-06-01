import { useState } from "react";
import { useMutation } from "@apollo/client/react";
import { GenerateTagsDocument } from "@/shared/graphql/content-documents";
import { getGraphQLErrorMessage } from "@/shared/api";
import { useToast } from "@/shared/ui/hooks/useToast";
import {
  MIN_TAG_BODY_LENGTH,
  MIN_TAG_TITLE_LENGTH,
  normalizeTags,
} from "@/entities/post/lib";

export interface UsePostTagInputArgs {
  initialTags: string[];
  title: string;
  contentText: string;
}

export interface UsePostTagInputResult {
  tags: string[];
  newTag: string;
  isDialogOpen: boolean;
  isGenerating: boolean;
  canGenerate: boolean;
  setNewTag: (value: string) => void;
  setIsDialogOpen: (open: boolean) => void;
  addTag: () => void;
  removeTag: (tag: string) => void;
  replaceTags: (next: string[]) => void;
  generateTags: () => Promise<void>;
}

export const usePostTagInput = ({
  initialTags,
  title,
  contentText,
}: UsePostTagInputArgs): UsePostTagInputResult => {
  const { toast } = useToast();
  const [tags, setTags] = useState<string[]>(initialTags);
  const [newTag, setNewTag] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [mutate, { loading: isGenerating }] = useMutation(GenerateTagsDocument);

  const trimmedTitle = title.trim();
  const canGenerate =
    trimmedTitle.length >= MIN_TAG_TITLE_LENGTH &&
    contentText.length >= MIN_TAG_BODY_LENGTH;

  const replaceTags = (next: string[]) => setTags(normalizeTags(next));

  const addTag = () => {
    const trimmed = newTag.trim();
    if (!trimmed) {
      toast({
        title: "Empty Tag",
        description: "Tag cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    if (tags.includes(trimmed)) {
      toast({
        title: "Duplicate Tag",
        description: "This tag has already been added.",
        variant: "destructive",
      });
      return;
    }
    setTags([...tags, trimmed]);
    setNewTag("");
    setIsDialogOpen(false);
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const generateTags = async () => {
    if (!canGenerate) {
      toast({
        title: "Not Enough Content",
        description:
          "Add a longer title and more content before generating tags.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data } = await mutate({
        variables: { title: trimmedTitle, body: contentText },
      });
      const generated = normalizeTags(data?.generateTags ?? []);

      if (generated.length === 0) {
        toast({
          title: "No Tags Generated",
          description: "Try adding more context and generate again.",
          variant: "destructive",
        });
        return;
      }

      setTags(normalizeTags([...tags, ...generated]));
      toast({
        title: "Tags Generated",
        description: `Added ${generated.length} tag${generated.length === 1 ? "" : "s"}.`,
      });
    } catch (error) {
      toast({
        title: "Tag Generation Failed",
        description: getGraphQLErrorMessage(
          error,
          "Unable to generate tags right now.",
        ),
        variant: "destructive",
      });
    }
  };

  return {
    tags,
    newTag,
    isDialogOpen,
    isGenerating,
    canGenerate,
    setNewTag,
    setIsDialogOpen,
    addTag,
    removeTag,
    replaceTags,
    generateTags,
  };
};
