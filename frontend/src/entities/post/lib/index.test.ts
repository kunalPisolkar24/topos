import { describe, expect, it } from "vitest";
import {
  buildSearchPagination,
  formatBlogCardDate,
  formatBlogCardTag,
  getAuthorDisplayName,
  mapPostToBlogCardItem,
  normalizeTags,
  stripHtml,
  toPlainText,
} from "./index";

describe("toPlainText", () => {
  it("strips html tags and normalizes whitespace", () => {
    expect(toPlainText("<p>Hello&nbsp;world</p><p>foo   bar</p>")).toBe(
      "Hello world foo bar",
    );
  });

  it("returns empty string for empty input", () => {
    expect(toPlainText("")).toBe("");
  });
});

describe("normalizeTags", () => {
  it("trims, dedupes, and drops empty strings", () => {
    expect(normalizeTags(["react ", "  react", "typescript", ""])).toEqual([
      "react",
      "typescript",
    ]);
  });
});

describe("stripHtml", () => {
  it("strips simple tags", () => {
    expect(stripHtml("<p>hello</p>")).toBe("hello");
  });
});

describe("getAuthorDisplayName", () => {
  it("falls back to username when name is empty", () => {
    expect(getAuthorDisplayName({ username: "kunal", name: "" })).toBe("kunal");
  });

  it("prefers trimmed name when present", () => {
    expect(
      getAuthorDisplayName({ username: "kunal", name: "  Kunal  " }),
    ).toBe("Kunal");
  });
});

describe("formatBlogCardDate", () => {
  it("formats ISO date into uppercased US short format", () => {
    expect(formatBlogCardDate("2024-05-12T00:00:00Z")).toBe("MAY 12, 2024");
  });

  it("returns null for invalid date input", () => {
    expect(formatBlogCardDate("not a date")).toBeNull();
  });
});

describe("formatBlogCardTag", () => {
  it("normalizes whitespace, strips leading hashes, and uppercases", () => {
    expect(formatBlogCardTag("##hello world")).toBe("#HELLO_WORLD");
  });
});

describe("mapPostToBlogCardItem", () => {
  it("maps a post to a view-model and trims the snippet to 150 chars", () => {
    const longBody = "x".repeat(500);
    const item = mapPostToBlogCardItem({
      id: "1",
      title: "Title",
      body: `<p>${longBody}</p>`,
      imageUrl: "https://cdn/img.jpg",
      createdAt: "2024-05-12T00:00:00Z",
      author: { username: "kunal", name: "Kunal" },
      tags: [{ name: "react" }, { name: "type" }],
    });
    expect(item.id).toBe("1");
    expect(item.title).toBe("Title");
    expect(item.snippet.endsWith("...")).toBe(true);
    expect(item.snippet.length).toBeLessThanOrEqual(154);
    expect(item.author.name).toBe("Kunal");
    expect(item.tags).toEqual(["react", "type"]);
    expect(item.imageUrl).toBe("https://cdn/img.jpg");
    expect(item.publishedAt).toBe("2024-05-12T00:00:00Z");
  });

  it("falls back to default image when missing", () => {
    const item = mapPostToBlogCardItem({
      id: "1",
      title: "t",
      body: "b",
      imageUrl: null,
      createdAt: "2024-05-12T00:00:00Z",
      author: { username: "u" },
      tags: [],
    });
    expect(item.imageUrl).toMatch(/^https:\/\/images\.unsplash\.com/);
  });
});

describe("buildSearchPagination", () => {
  it("computes total pages with a minimum of 1", () => {
    expect(buildSearchPagination(0, 1, 6)).toEqual({
      currentPage: 1,
      totalPages: 1,
      totalResults: 0,
    });
    expect(buildSearchPagination(12, 2, 6)).toEqual({
      currentPage: 2,
      totalPages: 2,
      totalResults: 12,
    });
  });
});
