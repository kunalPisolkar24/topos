import type {
  DraftGenerationInput,
  WritingAudience as WritingAudienceInput,
  WritingBriefInput,
  WritingLength as WritingLengthInput,
  WritingStructure as WritingStructureInput,
  WritingTone as WritingToneInput,
} from "@/shared/graphql/content-documents";

export const WRITING_AUDIENCES = [
  "beginner",
  "practitioner",
  "expert",
] as const;

export const WRITING_TONES = [
  "professional",
  "conversational",
  "technical",
  "storytelling",
  "witty",
  "minimal",
] as const;

export const WRITING_LENGTHS = ["quick", "standard", "deep"] as const;

export const WRITING_STRUCTURES = [
  "how-to",
  "listicle",
  "tutorial",
  "comparison",
  "opinion",
  "case-study",
] as const;

export type WritingAudience = (typeof WRITING_AUDIENCES)[number];
export type WritingTone = (typeof WRITING_TONES)[number];
export type WritingLength = (typeof WRITING_LENGTHS)[number];
export type WritingStructure = (typeof WRITING_STRUCTURES)[number];

export interface WritingBrief {
  topic: string;
  keyPoints: string;
  audience: WritingAudience;
  tone: WritingTone;
  length: WritingLength;
  structure: WritingStructure;
  keywords: string;
}

export interface OutlineSection {
  id: string;
  heading: string;
  bullets: string[];
  targetWords: number;
}

export type StudioStep = "brief" | "outline" | "draft";

export interface StudioDraft {
  title: string;
  body: string;
  summary: string;
  tags: string[];
}

export const DEFAULT_WRITING_BRIEF: WritingBrief = {
  topic: "",
  keyPoints: "",
  audience: "practitioner",
  tone: "professional",
  length: "standard",
  structure: "how-to",
  keywords: "",
};

const orNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export const toDraftGenerationInput = (
  brief: WritingBrief,
): DraftGenerationInput => ({
  source: "GUIDED_STUDIO",
  prompt: brief.topic.trim(),
  audience: brief.audience,
  tone: brief.tone,
  length: brief.length,
  structure: brief.structure,
  keywords: orNull(brief.keywords),
  keyPoints: orNull(brief.keyPoints),
});

const BRIEF_AUDIENCE: Record<WritingAudience, WritingAudienceInput> = {
  beginner: "BEGINNER",
  practitioner: "PRACTITIONER",
  expert: "EXPERT",
};

const BRIEF_TONE: Record<WritingTone, WritingToneInput> = {
  professional: "PROFESSIONAL",
  conversational: "CONVERSATIONAL",
  technical: "TECHNICAL",
  storytelling: "STORYTELLING",
  witty: "WITTY",
  minimal: "MINIMAL",
};

const BRIEF_LENGTH: Record<WritingLength, WritingLengthInput> = {
  quick: "QUICK",
  standard: "STANDARD",
  deep: "DEEP_DIVE",
};

const BRIEF_STRUCTURE: Record<WritingStructure, WritingStructureInput> = {
  "how-to": "HOW_TO",
  listicle: "LISTICLE",
  tutorial: "TUTORIAL",
  comparison: "COMPARISON",
  opinion: "OPINION",
  "case-study": "CASE_STUDY",
};

export const toWritingBriefInput = (brief: WritingBrief): WritingBriefInput => ({
  audience: BRIEF_AUDIENCE[brief.audience],
  tone: BRIEF_TONE[brief.tone],
  length: BRIEF_LENGTH[brief.length],
  structure: BRIEF_STRUCTURE[brief.structure],
  keywords: orNull(brief.keywords),
  keyPoints: orNull(brief.keyPoints),
});
