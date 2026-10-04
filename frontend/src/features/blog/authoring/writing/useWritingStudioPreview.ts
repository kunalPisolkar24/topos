import { useMemo, useState } from "react";
import { MIN_PROMPT_LENGTH } from "@/entities/post/lib";
import {
  FAKE_PREVIEW_DELAY_MS,
  buildFakeDraft,
  buildFakeOutline,
  buildFakeSectionHtml,
  sleep,
} from "./fakeWritingAgent";
import {
  DEFAULT_WRITING_BRIEF,
  type OutlineSection,
  type StudioStep,
  type WritingBrief,
} from "./types";

export interface UseWritingStudioPreviewArgs {
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
  onTagsChange: (tags: string[]) => void;
  onSummaryChange: (summary: string | null) => void;
}

export interface UseWritingStudioPreviewResult {
  brief: WritingBrief;
  step: StudioStep;
  outline: OutlineSection[];
  bodies: Record<string, string>;
  isGeneratingOutline: boolean;
  isExpanding: boolean;
  expandingId: string | null;
  canGenerateOutline: boolean;
  canExpand: boolean;
  canApply: boolean;
  setBriefField: <K extends keyof WritingBrief>(
    field: K,
    value: WritingBrief[K],
  ) => void;
  generateOutline: () => Promise<void>;
  moveSection: (id: string, direction: -1 | 1) => void;
  updateSectionHeading: (id: string, heading: string) => void;
  removeSection: (id: string) => void;
  regenerateSection: (id: string) => Promise<void>;
  expandAll: () => Promise<void>;
  applyToEditor: () => void;
  reset: () => void;
}

export const useWritingStudioPreview = ({
  onTitleChange,
  onContentChange,
  onTagsChange,
  onSummaryChange,
}: UseWritingStudioPreviewArgs): UseWritingStudioPreviewResult => {
  const [brief, setBrief] = useState<WritingBrief>(DEFAULT_WRITING_BRIEF);
  const [step, setStep] = useState<StudioStep>("brief");
  const [outline, setOutline] = useState<OutlineSection[]>([]);
  const [bodies, setBodies] = useState<Record<string, string>>({});
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const [expandingId, setExpandingId] = useState<string | null>(null);

  const canGenerateOutline =
    brief.topic.trim().length >= MIN_PROMPT_LENGTH && !isGeneratingOutline;

  const canExpand = outline.length > 0 && !isExpanding && !isGeneratingOutline;
  const canApply = step === "draft" && outline.length > 0 && !isExpanding;

  const draftPreview = useMemo(
    () => buildFakeDraft(brief, outline, bodies),
    [brief, outline, bodies],
  );

  const setBriefField = <K extends keyof WritingBrief>(
    field: K,
    value: WritingBrief[K],
  ) => {
    setBrief((current) => ({ ...current, [field]: value }));
  };

  const generateOutline = async () => {
    if (!canGenerateOutline) return;
    setIsGeneratingOutline(true);
    await sleep(FAKE_PREVIEW_DELAY_MS);
    setOutline(buildFakeOutline(brief));
    setBodies({});
    setStep("outline");
    setIsGeneratingOutline(false);
  };

  const moveSection = (id: string, direction: -1 | 1) => {
    setOutline((current) => {
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
    setOutline((current) =>
      current.map((section) =>
        section.id === id ? { ...section, heading } : section,
      ),
    );
  };

  const removeSection = (id: string) => {
    setOutline((current) => current.filter((section) => section.id !== id));
    setBodies((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const expandSectionBody = async (id: string, variant = 0) => {
    const section = outline.find((item) => item.id === id);
    if (!section) return;
    setExpandingId(id);
    await sleep(FAKE_PREVIEW_DELAY_MS);
    setBodies((current) => ({
      ...current,
      [id]: buildFakeSectionHtml(brief, section, variant),
    }));
    setExpandingId(null);
  };

  const regenerateSection = async (id: string) => {
    if (isExpanding) return;
    setIsExpanding(true);
    await expandSectionBody(id, Date.now() % 3);
    setIsExpanding(false);
  };

  const expandAll = async () => {
    if (!canExpand) return;
    setIsExpanding(true);
    for (const section of outline) {
      setExpandingId(section.id);
      await sleep(FAKE_PREVIEW_DELAY_MS);
      setBodies((current) => ({
        ...current,
        [section.id]: buildFakeSectionHtml(brief, section),
      }));
    }
    setExpandingId(null);
    setIsExpanding(false);
    setStep("draft");
  };

  const applyToEditor = () => {
    if (!canApply) return;
    onTitleChange(draftPreview.title);
    onContentChange(draftPreview.body);
    onTagsChange(draftPreview.tags);
    onSummaryChange(draftPreview.summary);
  };

  const reset = () => {
    setStep("brief");
    setOutline([]);
    setBodies({});
  };

  return {
    brief,
    step,
    outline,
    bodies,
    isGeneratingOutline,
    isExpanding,
    expandingId,
    canGenerateOutline,
    canExpand,
    canApply,
    setBriefField,
    generateOutline,
    moveSection,
    updateSectionHeading,
    removeSection,
    regenerateSection,
    expandAll,
    applyToEditor,
    reset,
  };
};
