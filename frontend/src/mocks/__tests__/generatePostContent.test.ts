import { describe, expect, it } from "vitest";
import { generatePostContent } from "../data";
import { previewGeneratePostContent } from "../preview/preview-store";

describe("brief-aware generation fakes", () => {
  it("echoes the brief into full drafts", () => {
    const draft = generatePostContent("Postgres indexing at scale", {
      tone: "WITTY",
      audience: "EXPERT",
      structure: "HOW_TO",
    });
    expect(draft.body).toContain("WITTY");
    expect(draft.body).toContain("EXPERT");
  });

  it("rewrites a single section with the instruction", () => {
    const draft = previewGeneratePostContent(
      'Rewrite section "Pitfalls" for post about "Postgres".\nInstruction: make it shorter.',
      { tone: "TECHNICAL" },
    );
    expect(draft.body).toContain("Pitfalls");
    expect(draft.body).toContain("make it shorter");
  });
});
