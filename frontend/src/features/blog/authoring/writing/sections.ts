import { toPlainText } from "@/entities/post/lib";

export interface BodySection {
  id: string;
  heading: string;
  bodyHtml: string;
}

const HEADING_PATTERN = /<h2>([\s\S]*?)<\/h2>/gi;

const escapeHeading = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export const splitBodySections = (body: string): BodySection[] => {
  const sections: BodySection[] = [];
  let index = 0;
  const push = (heading: string, bodyHtml: string) => {
    const html = bodyHtml.trim();
    if (!heading && !html) return;
    index += 1;
    sections.push({ id: `section-${index}`, heading, bodyHtml: html });
  };

  HEADING_PATTERN.lastIndex = 0;
  let cursor = 0;
  let heading = "";
  let match: RegExpExecArray | null;
  while ((match = HEADING_PATTERN.exec(body)) !== null) {
    push(cursor === 0 ? "" : heading, body.slice(cursor, match.index));
    heading = toPlainText(match[1]);
    cursor = match.index + match[0].length;
  }
  push(cursor === 0 ? "" : heading, body.slice(cursor));
  return sections;
};

export const joinBodySections = (sections: BodySection[]): string =>
  sections
    .map((section) =>
      section.heading
        ? `<h2>${escapeHeading(section.heading)}</h2>${section.bodyHtml}`
        : section.bodyHtml,
    )
    .join("\n");
