import { describe, expect, it } from "vitest";
import { domainError, isDomainError } from "./errors";

describe("domainError", () => {
  it("creates a DomainError with code and message", () => {
    const e = domainError("NOT_FOUND", "Post not found");
    expect(e.code).toBe("NOT_FOUND");
    expect(e.message).toBe("Post not found");
    expect(e.cause).toBeUndefined();
    expect(e.issues).toBeUndefined();
  });

  it("attaches cause and issues when provided", () => {
    const cause = new Error("upstream");
    const issues = [{ path: "title", message: "required" }];
    const e = domainError("VALIDATION", "Invalid input", { cause, issues });
    expect(e.cause).toBe(cause);
    expect(e.issues).toEqual(issues);
  });

  it("omits cause and issues when undefined", () => {
    const e = domainError("UNKNOWN", "x");
    expect("cause" in e).toBe(false);
    expect("issues" in e).toBe(false);
  });
});

describe("isDomainError", () => {
  it("returns true for valid DomainError shapes", () => {
    expect(isDomainError(domainError("GRAPHQL", "fail"))).toBe(true);
  });

  it("returns false for non-objects and missing fields", () => {
    expect(isDomainError(null)).toBe(false);
    expect(isDomainError("nope")).toBe(false);
    expect(isDomainError({ code: 1, message: "x" })).toBe(false);
    expect(isDomainError({ code: "X" })).toBe(false);
  });
});
