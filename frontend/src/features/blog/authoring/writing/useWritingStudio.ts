import { useState } from "react";
import { postRepository } from "@/entities/post/api/postRepository";
import { MIN_PROMPT_LENGTH, normalizeTags, toPlainText } from "@/entities/post/lib";
import { getGraphQLErrorMessage } from "@/shared/api";
import { useToast } from "@/shared/ui/hooks/useToast";
import { joinBodySections, splitBodySections, type BodySection } from "./sections";
import {
  DEFAULT_WRITING_BRIEF,
  toWritingBriefInput,
  type WritingBrief,
} from "./types";

export interface UseWritingStudioArgs {
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
  onTagsChange: (tags: string[]) => void;
  onSummaryChange: (summary: string | null) => void;
  onApplied?: (brief: WritingBrief) => void;
}

export interface StudioDraftMeta {
  title: string;
  summary: string;
  tags: string[];
}

export interface UseWritingStudioResult {
  brief: WritingBrief;
  step: "brief" | "draft";
  sections: BodySection[];
  isGenerating: boolean;
  regeneratingSectionId: string | null;
  canGenerate: boolean;
  canApply: boolean;
  setBriefField: <K extends keyof WritingBrief>(
    field: K,
    value: WritingBrief[K],
  ) => void;
  generate: () => Promise<void>;
  regenerateAll: () => Promise<void>;
  regenerateSection: (id: string, instruction?: string) => Promise<void>;
  moveSection: (id: string, direction: -1 | 1) => void;
  updateSectionHeading: (id: string, heading: string) => void;
  updateSectionBody: (id: string, bodyHtml: string) => void;
  removeSection: (id: string) => void;
  applyToEditor: () => void;
  editBrief: () => void;
  reset: () => void;
}

export const useWritingStudio = ({
  onTitleChange,
  onContentChange,
  onTagsChange,
  onSummaryChange,
  onApplied,
}: UseWritingStudioArgs): UseWritingStudioResult => {
  const { toast } = useToast();
  const [brief, setBrief] = useState<WritingBrief>(DEFAULT_WRITING_BRIEF);
  const [step, setStep] = useState<"brief" | "draft">("brief");
  const [sections, setSections] = useState<BodySection[]>([]);
  const [draftMeta, setDraftMeta] = useState<StudioDraftMeta | null>(null);

  const [mutate, { loading: isGenerating }] =
    postRepository.useGenerateDraft();
  const [regeneratingSectionId, setRegeneratingSectionId] = useState<string | null>(null);

  const canGenerate =
    brief.topic.trim().length >= MIN_PROMPT_LENGTH && !isGenerating;
  const canApply =
    step === "draft" &&
    sections.length > 0 &&
    !isGenerating &&
    regeneratingSectionId === null;

  const setBriefField = <K extends keyof WritingBrief>(
    field: K,
    value: WritingBrief[K],
  ) => {
    setBrief((current) => ({ ...current, [field]: value }));
  };

  const generate = async () => {
    const topic = brief.topic.trim();
    if (topic.length < MIN_PROMPT_LENGTH) {
      toast({
        title: "Topic Too Short",
        description: "Describe the topic, reader, and angle in a few more words.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data } = await mutate({
        variables: { prompt: topic, brief: toWritingBriefInput(brief) },
      });
      const generated = data?.generatePostContent;
      const nextSections = splitBodySections(generated?.body ?? "");
      if (!generated?.title || nextSections.length === 0) {
        toast({
          title: "Incomplete Draft",
          description: "The generated draft is missing required content.",
          variant: "destructive",
        });
        return;
      }

      setSections(nextSections);
      setDraftMeta({
        title: generated.title,
        summary: generated.summary ?? "",
        tags: normalizeTags(generated.tags ?? []),
      });
      setStep("draft");
      toast({
        title: "Draft Generated",
        description: "Review the sections, then apply them to the editor.",
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

  const moveSection = (id: string, direction: -1 | 1) => {
    setSections((current) => {
      const index = current.findIndex((section) => section.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const updateSectionHeading = (id: string, heading: string) => {
    setSections((current) =>
      current.map((section) =>
        section.id === id ? { ...section, heading } : section,
      ),
    );
  };

  const updateSectionBody = (id: string, bodyHtml: string) => {
    setSections((current) =>
      current.map((section) =>
        section.id === id ? { ...section, bodyHtml } : section,
      ),
    );
  };

  const removeSection = (id: string) => {
    setSections((current) => current.filter((section) => section.id !== id));
  };

  const regenerateAll = async () => {
    await generate();
  };

  const regenerateSection = async (id: string, instruction?: string) => {
    const target = sections.find((section) => section.id === id);
    if (!target || isGenerating || regeneratingSectionId !== null) return;
    const topic = brief.topic.trim();
    if (topic.length < MIN_PROMPT_LENGTH) {
      toast({
        title: "Topic Too Short",
        description: "Describe the topic, reader, and angle in a few more words.",
        variant: "destructive",
      });
      return;
    }
    const heading = target.heading || "Introduction";
    const siblings = sections
      .filter((section) => section.id !== id)
      .map((section) => section.heading || "Introduction")
      .join(", ");
    const currentText = toPlainText(target.bodyHtml).slice(0, 2000);
    const prompt = [
      `Rewrite section "${heading}" for post about "${topic}".`,
      `Instruction: ${(instruction ?? "").trim() || "Rewrite with a fresh angle"}.`,
      siblings ? `Other sections: ${siblings}.` : "",
      currentText ? `Current section content: ${currentText}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    setRegeneratingSectionId(id);
    try {
      const { data } = await mutate({
        variables: { prompt, brief: toWritingBriefInput(brief) },
      });
      const candidates = splitBodySections(data?.generatePostContent?.body ?? "");
      const match =
        candidates.find(
          (candidate) =>
            candidate.heading.toLowerCase() === heading.toLowerCase(),
        ) ??
        candidates.find((candidate) => candidate.bodyHtml.trim()) ??
        candidates[0];
      if (!match?.bodyHtml.trim()) {
        toast({
          title: "Incomplete Section",
          description: "The regenerated section came back empty.",
          variant: "destructive",
        });
        return;
      }
      setSections((current) =>
        current.map((section) =>
          section.id === id ? { ...section, bodyHtml: match.bodyHtml } : section,
        ),
      );
      toast({
        title: "Section Regenerated",
        description: `Rewrote "${heading}". Review it, then apply to the editor.`,
      });
    } catch (error) {
      toast({
        title: "Section Regeneration Failed",
        description: getGraphQLErrorMessage(
          error,
          "Unable to regenerate this section right now.",
        ),
        variant: "destructive",
      });
    } finally {
      setRegeneratingSectionId(null);
    }
  };

  const applyToEditor = () => {
    if (!canApply || !draftMeta) return;
    onTitleChange(draftMeta.title);
    onContentChange(joinBodySections(sections));
    onTagsChange(draftMeta.tags);
    onSummaryChange(draftMeta.summary || null);
    onApplied?.(brief);
  };

  const reset = () => {
    setStep("brief");
    setSections([]);
    setDraftMeta(null);
    setRegeneratingSectionId(null);
  };

  const editBrief = () => {
    setStep("brief");
  };

  return {
    brief,
    step,
    sections,
    isGenerating,
    regeneratingSectionId,
    canGenerate,
    canApply,
    setBriefField,
    generate,
    regenerateAll,
    regenerateSection,
    moveSection,
    updateSectionHeading,
    updateSectionBody,
    removeSection,
    applyToEditor,
    editBrief,
    reset,
  };
};
