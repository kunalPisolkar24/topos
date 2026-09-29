import DOMPurify from "dompurify";

const SANITIZE_CONFIG = {
  ADD_TAGS: ["iframe"],
  ADD_ATTR: [
    "allow",
    "allowfullscreen",
    "frameborder",
    "scrolling",
    "src",
    "width",
    "height",
    "title",
    "loading",
  ],
} as const;

export const NON_BREAKING_HYPHEN = "‑";

const COMPOUND_HYPHEN_PATTERN = /(\w)-(\w)/g;

const NON_BREAKABLE_ANCESTORS = new Set([
  "A",
  "CODE",
  "PRE",
  "SCRIPT",
  "STYLE",
]);

const bindHyphenatedCompounds = (html: string): string => {
  try {
    if (typeof DOMParser === "undefined" || typeof NodeFilter === "undefined") {
      return html;
    }
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
    const root = doc.body.firstElementChild ?? doc.body;
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let current = walker.nextNode() as Text | null;
    while (current) {
      textNodes.push(current);
      current = walker.nextNode() as Text | null;
    }
    for (const textNode of textNodes) {
      if (!textNode.nodeValue?.includes("-")) {
        continue;
      }
      if (
        textNode.parentElement &&
        NON_BREAKABLE_ANCESTORS.has(textNode.parentElement.tagName)
      ) {
        continue;
      }
      textNode.nodeValue = textNode.nodeValue.replace(
        COMPOUND_HYPHEN_PATTERN,
        `$1${NON_BREAKING_HYPHEN}$2`,
      );
    }
    return root.innerHTML;
  } catch {
    return html;
  }
};

export const sanitizeRichHtml = (html: string): string => {
  const clean = DOMPurify.sanitize(html, {
    ADD_TAGS: [...SANITIZE_CONFIG.ADD_TAGS],
    ADD_ATTR: [...SANITIZE_CONFIG.ADD_ATTR],
  });
  return bindHyphenatedCompounds(clean);
};
