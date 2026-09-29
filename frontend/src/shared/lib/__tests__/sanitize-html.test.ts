import { describe, expect, it } from "vitest";
import { NON_BREAKING_HYPHEN, sanitizeRichHtml } from "../sanitize-html";

describe("sanitizeRichHtml hyphen handling", () => {
  it("binds hyphenated compounds with a non-breaking hyphen", () => {
    const clean = sanitizeRichHtml("<p>real-life heroes</p>");
    expect(clean).toContain(`real${NON_BREAKING_HYPHEN}life`);
    expect(clean).not.toContain("real-life");
  });

  it("binds every hyphen in multi-part compounds", () => {
    const clean = sanitizeRichHtml("<p>state-of-the-art</p>");
    expect(clean).toContain(
      `state${NON_BREAKING_HYPHEN}of${NON_BREAKING_HYPHEN}the${NON_BREAKING_HYPHEN}art`,
    );
  });

  it("leaves standalone dashes breakable", () => {
    const clean = sanitizeRichHtml("<p>well - being</p>");
    expect(clean).toContain("well - being");
  });

  it("leaves code, pre, and link text untouched", () => {
    const code = sanitizeRichHtml("<code>real-life</code>");
    expect(code).toContain("real-life");

    const pre = sanitizeRichHtml("<pre>well-being</pre>");
    expect(pre).toContain("well-being");

    const link = sanitizeRichHtml(
      '<a href="https://example.com/my-page">my-page</a>',
    );
    expect(link).toContain("my-page");
    expect(link).not.toContain(`my${NON_BREAKING_HYPHEN}page`);
  });

  it("still strips unsafe markup", () => {
    const clean = sanitizeRichHtml(
      "<p>Safe</p><script>alert('xss')</script>",
    );
    expect(clean).toContain("Safe");
    expect(clean).not.toContain("script");
  });
});
