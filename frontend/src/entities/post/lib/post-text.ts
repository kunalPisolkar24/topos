export function toPlainText(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTags(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export const MIN_TAG_TITLE_LENGTH = 5;
export const MIN_TAG_BODY_LENGTH = 80;
export const MIN_PROMPT_LENGTH = 30;
export const POST_SNIPPET_MAX_LENGTH = 150;
