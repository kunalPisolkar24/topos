import { useState } from "react";
import { useMutation } from "@apollo/client/react";
import { GeneratePostContentDocument } from "@/shared/graphql/content-documents";
import { getGraphQLErrorMessage } from "@/shared/api";
import { useToast } from "@/shared/ui/hooks/useToast";
import { MIN_PROMPT_LENGTH, normalizeTags } from "@/entities/post/lib";

export interface UsePostAIDraftArgs {
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
  onTagsChange: (tags: string[]) => void;
}

export interface UsePostAIDraftResult {
  prompt: string;
  setPrompt: (value: string) => void;
  summary: string | null;
  setSummary: (value: string | null) => void;
  isSummaryVisible: boolean;
  setIsSummaryVisible: (visible: boolean) => void;
  isGenerating: boolean;
  canGenerate: boolean;
  generate: () => Promise<void>;
  clear: () => void;
  toggleSummary: () => void;
}

export const usePostAIDraft = ({
  onTitleChange,
  onContentChange,
  onTagsChange,
}: UsePostAIDraftArgs): UsePostAIDraftResult => {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummaryVisible, setIsSummaryVisible] = useState(false);

  const [mutate, { loading: isGenerating }] = useMutation(
    GeneratePostContentDocument,
  );

  const trimmedPrompt = prompt.trim();
  const canGenerate = trimmedPrompt.length >= MIN_PROMPT_LENGTH;

  const generate = async () => {
    if (trimmedPrompt.length < MIN_PROMPT_LENGTH) {
      toast({
        title: "Prompt Too Short",
        description: "Provide a longer prompt to generate a full draft.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data } = await mutate({ variables: { prompt: trimmedPrompt } });
      const generated = data?.generatePostContent;
      if (!generated?.title || !generated?.body) {
        toast({
          title: "Incomplete Draft",
          description: "The generated draft is missing required content.",
          variant: "destructive",
        });
        return;
      }

      onTitleChange(generated.title);
      onContentChange(generated.body);
      onTagsChange(normalizeTags(generated.tags ?? []));
      setSummary(generated.summary ?? null);
      setIsSummaryVisible(false);
      toast({
        title: "Draft Generated",
        description: "Title, content, and tags have been updated.",
      });
    } catch (error) {
      toast({
        title: "Post Generation Failed",
        description: getGraphQLErrorMessage(
          error,
          "Unable to generate a draft right now.",
        ),
        variant: "destructive",
      });
    }
  };

  const clear = () => {
    setPrompt("");
    setSummary(null);
    setIsSummaryVisible(false);
  };

  const toggleSummary = () => setIsSummaryVisible((value) => !value);

  return {
    prompt,
    setPrompt,
    summary,
    setSummary,
    isSummaryVisible,
    setIsSummaryVisible,
    isGenerating,
    canGenerate,
    generate,
    clear,
    toggleSummary,
  };
};
