import { normalizeTags } from "@/entities/post/lib";
import type {
  OutlineSection,
  StudioDraft,
  WritingBrief,
} from "./types";

const STRUCTURE_HEADINGS: Record<WritingBrief["structure"], string[]> = {
  "how-to": ["Setup in minutes", "Step-by-step walkthrough", "Common pitfalls"],
  listicle: ["Why it matters", "Key ideas worth stealing", "Putting it together"],
  tutorial: ["Prerequisites", "Build it end to end", "Verify and debug"],
  comparison: ["Option A in practice", "Option B in practice", "Which to pick"],
  opinion: ["The argument", "Counterpoints", "Where this lands"],
  "case-study": ["Starting point", "What changed", "Results and takeaways"],
};

const LENGTH_WORDS: Record<WritingBrief["length"], number> = {
  quick: 80,
  standard: 160,
  "deep": 260,
};

export const FAKE_PREVIEW_DELAY_MS = 600;

export const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const slugify = (value: string, fallback: string) => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return slug || fallback;
};

export const buildFakeOutline = (brief: WritingBrief): OutlineSection[] => {
  const topic = brief.topic.trim() || "Untitled topic";
  const middle = STRUCTURE_HEADINGS[brief.structure];
  const words = LENGTH_WORDS[brief.length];
  const headings = [`Framing: ${topic}`, ...middle, "Closing takeaways"];
  return headings.map((heading, index) => ({
    id: `section-${index + 1}`,
    heading,
    bullets:
      brief.keyPoints.trim().length > 0 && index === 1
        ? brief.keyPoints
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .slice(0, 3)
        : [`Angle for ${brief.audience}s`, `Keep the ${brief.tone} voice`],
    targetWords: words,
  }));
};

export const buildFakeSectionHtml = (
  brief: WritingBrief,
  section: OutlineSection,
  variant = 0,
): string => {
  const openers = [
    `Draft preview written in a ${brief.tone} voice for ${brief.audience}s.`,
    `Alternate take in the same ${brief.tone} voice, reframed for ${brief.audience}s.`,
    `Tighter rewrite keeping the ${brief.tone} voice and ${brief.structure} shape.`,
  ];
  const opener = openers[variant % openers.length];
  const bullets = section.bullets.map((bullet) => `<li>${bullet}</li>`).join("");
  const keywords = brief.keywords.trim()
    ? `<p><strong>Keywords:</strong> ${brief.keywords.trim()}</p>`
    : "";
  return (
    `<h2>${section.heading}</h2>` +
    `<p>${opener} This is emulated output for "${brief.topic.trim()}" — no backend call yet.</p>` +
    `<ul>${bullets}</ul>` +
    keywords
  );
};

export const buildFakeDraft = (
  brief: WritingBrief,
  outline: OutlineSection[],
  bodies: Record<string, string>,
): StudioDraft => {
  const topic = brief.topic.trim() || "Untitled topic";
  const title = `${topic} — ${brief.structure} for ${brief.audience}s (preview)`;
  const body = outline
    .map((section) => bodies[section.id] ?? buildFakeSectionHtml(brief, section))
    .join("\n");
  const summary = `Preview draft about ${topic} in a ${brief.tone} voice. Outline has ${outline.length} sections; backend wiring comes next.`;
  const keywords = brief.keywords
    .split(",")
    .map((part) => slugify(part.trim(), ""))
    .filter(Boolean);
  const tags = normalizeTags([
    brief.structure,
    brief.tone,
    brief.audience,
    ...keywords,
  ]).slice(0, 6);
  return { title, body, summary, tags };
};
