import { describe, expect, it } from "vitest";
import {
  buildProfileUpdatePayload,
  getCharacterCount,
  PROFILE_BIO_MAX_LENGTH,
  PROFILE_NAME_MAX_LENGTH,
  sanitizeProfileBio,
  sanitizeProfileBioInput,
  sanitizeProfileFormData,
  sanitizeProfileName,
  sanitizeUsernameInput,
  USERNAME_MAX_LENGTH,
} from "./profile-sanitizers";

describe("getCharacterCount", () => {
  it("counts code points, not UTF-16 units", () => {
    expect(getCharacterCount("hello")).toBe(5);
    expect(getCharacterCount("héllo")).toBe(5);
  });
});

describe("sanitizeUsernameInput", () => {
  it("trims, collapses internal whitespace, and clamps length", () => {
    const long = "x".repeat(USERNAME_MAX_LENGTH + 5);
    const out = sanitizeUsernameInput(`  ${long}  `);
    expect(out.length).toBe(USERNAME_MAX_LENGTH);
    expect(out).toBe("x".repeat(USERNAME_MAX_LENGTH));
  });

  it("removes control characters", () => {
    expect(sanitizeUsernameInput("hello\u0000world")).toBe("helloworld");
  });
});

describe("sanitizeProfileName", () => {
  it("clamps to the name max length", () => {
    const tooLong = "a".repeat(PROFILE_NAME_MAX_LENGTH + 10);
    expect(sanitizeProfileName(tooLong).length).toBe(PROFILE_NAME_MAX_LENGTH);
  });
});

describe("sanitizeProfileBio and sanitizeProfileBioInput", () => {
  it("clamps bio to the bio max length", () => {
    const tooLong = "x".repeat(PROFILE_BIO_MAX_LENGTH + 50);
    expect(sanitizeProfileBio(tooLong).length).toBe(PROFILE_BIO_MAX_LENGTH);
    expect(sanitizeProfileBioInput(tooLong).length).toBe(PROFILE_BIO_MAX_LENGTH);
  });

  it("collapses runs of newlines down to a single blank line", () => {
    expect(sanitizeProfileBio("a\n\n\n\nb")).toBe("a\n\nb");
  });
});

describe("sanitizeProfileFormData", () => {
  it("normalizes name and bio together", () => {
    const out = sanitizeProfileFormData({ name: "  Kunal  ", bio: "x" });
    expect(out.name).toBe("Kunal");
    expect(out.bio).toBe("x");
  });

  it("uses empty string defaults for missing fields", () => {
    expect(sanitizeProfileFormData({})).toEqual({ name: "", bio: "" });
  });
});

describe("buildProfileUpdatePayload", () => {
  it("returns empty payload when next equals current", () => {
    const same = { name: "Kunal", bio: "Hello" };
    expect(buildProfileUpdatePayload(same, same)).toEqual({});
  });

  it("includes changed name and bio", () => {
    const next = { name: "Kunal P", bio: "Author" };
    const current = { name: "Kunal", bio: "Hello" };
    expect(buildProfileUpdatePayload(next, current)).toEqual({
      name: "Kunal P",
      bio: "Author",
    });
  });

  it("omits empty names and converts empty bios to null", () => {
    const next = { name: "", bio: "" };
    const current = { name: "Kunal", bio: "Hello" };
    expect(buildProfileUpdatePayload(next, current)).toEqual({ bio: null });
  });
});
