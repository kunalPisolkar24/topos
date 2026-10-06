import { joinBodySections, splitBodySections } from "../sections";

const BODY = [
  "<p>Intro paragraph.</p>",
  "<h2>Setup</h2><p>Setup body.</p>",
  "<h2>Pitfalls</h2><ul><li>First</li></ul>",
].join("\n");

describe("splitBodySections", () => {
  it("splits h2 sections keeping intro separate", () => {
    const sections = splitBodySections(BODY);

    expect(sections).toHaveLength(3);
    expect(sections[0]).toMatchObject({ heading: "" });
    expect(sections[0].bodyHtml).toContain("Intro paragraph.");
    expect(sections[1].heading).toBe("Setup");
    expect(sections[1].bodyHtml).toContain("Setup body.");
    expect(sections[2].heading).toBe("Pitfalls");
    expect(sections.map((section) => section.id)).toEqual([
      "section-1",
      "section-2",
      "section-3",
    ]);
  });

  it("returns a single heading-less section without h2 markup", () => {
    const sections = splitBodySections("<p>Just prose.</p>");

    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBe("");
    expect(sections[0].bodyHtml).toContain("Just prose.");
  });

  it("returns nothing for empty bodies", () => {
    expect(splitBodySections("")).toEqual([]);
    expect(splitBodySections("   ")).toEqual([]);
  });
});

describe("joinBodySections", () => {
  it("round-trips split sections", () => {
    expect(joinBodySections(splitBodySections(BODY))).toBe(BODY);
  });

  it("escapes edited headings", () => {
    const sections = splitBodySections("<h2>Setup</h2><p>Body.</p>");
    sections[0].heading = 'A <b>bold</b> move & more';

    expect(joinBodySections(sections)).toContain(
      "<h2>A &lt;b&gt;bold&lt;/b&gt; move &amp; more</h2>",
    );
  });
});
