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
