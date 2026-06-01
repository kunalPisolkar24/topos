import { describe, expect, it } from "vitest";
import { canGenerateAiTags, evaluatePublishReadiness } from "./post-rules";

describe("evaluatePublishReadiness", () => {
  it("marks all gates ready when title, body, image, and tags are present", () => {
    const result = evaluatePublishReadiness({
      title: "Hello",
      body: "<p>Body content</p>",
      cardImagePreview: "data:image/png;base64,xxx",
      tags: ["react"],
    });
    expect(result.titleReady).toBe(true);
    expect(result.contentReady).toBe(true);
    expect(result.imageReady).toBe(true);
    expect(result.tagsReady).toBe(true);
    expect(result.publishDisabled).toBe(false);
    expect(result.publishLabel).toBe("Publish Post");
  });

  it("disables publish when uploading card image and shows the right label", () => {
    const result = evaluatePublishReadiness({
      title: "t",
      body: "b",
      cardImagePreview: "x",
      tags: ["a"],
      isUploadingCardImage: true,
    });
    expect(result.publishDisabled).toBe(true);
    expect(result.publishLabel).toBe("Uploading...");
  });

  it("shows publishing label when isCreatingPost is true", () => {
    const result = evaluatePublishReadiness({
      title: "t",
      body: "b",
      cardImagePreview: "x",
      tags: ["a"],
      isCreatingPost: true,
    });
    expect(result.publishDisabled).toBe(true);
    expect(result.publishLabel).toBe("Publishing...");
  });

  it("treats empty title and body as not ready", () => {
    const result = evaluatePublishReadiness({
      title: "   ",
      body: "",
      cardImagePreview: null,
      tags: [],
    });
    expect(result.titleReady).toBe(false);
    expect(result.contentReady).toBe(false);
    expect(result.imageReady).toBe(false);
    expect(result.tagsReady).toBe(false);
  });
});

describe("canGenerateAiTags", () => {
  it("requires both a long enough title and body", () => {
    expect(canGenerateAiTags("a".repeat(5), "a".repeat(80))).toBe(true);
    expect(canGenerateAiTags("a".repeat(4), "a".repeat(80))).toBe(false);
    expect(canGenerateAiTags("a".repeat(5), "a".repeat(79))).toBe(false);
  });
});
