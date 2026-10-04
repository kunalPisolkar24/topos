import { buildFakeDraft, buildFakeOutline } from "../fakeWritingAgent";
import type { WritingBrief } from "../types";

const brief: WritingBrief = {
  topic: "Postgres indexing for read-heavy feeds",
  keyPoints: "Covering indexes\nPartial indexes",
  audience: "practitioner",
  tone: "technical",
  length: "standard",
  structure: "how-to",
  keywords: "postgres, indexing",
};

describe("fakeWritingAgent", () => {
  it("builds a structured outline from the brief", () => {
    const outline = buildFakeOutline(brief);

    expect(outline).toHaveLength(5);
    expect(outline[0].heading).toContain("Postgres indexing");
    expect(outline.every((section) => section.targetWords > 0)).toBe(true);
  });

  it("assembles a draft with title, body, summary, and tags", () => {
    const outline = buildFakeOutline(brief);
    const draft = buildFakeDraft(brief, outline, {});

    expect(draft.title).toContain("Postgres indexing");
    expect(draft.body).toContain("<h2>");
    expect(draft.summary).toContain("Preview draft");
    expect(draft.tags).toContain("how-to");
  });
});
