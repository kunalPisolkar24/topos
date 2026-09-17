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

export const sanitizeRichHtml = (html: string): string =>
  DOMPurify.sanitize(html, {
    ADD_TAGS: [...SANITIZE_CONFIG.ADD_TAGS],
    ADD_ATTR: [...SANITIZE_CONFIG.ADD_ATTR],
  });
