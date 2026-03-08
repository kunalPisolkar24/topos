export const USERNAME_MAX_LENGTH = 30;
export const PROFILE_NAME_MAX_LENGTH = 50;
export const PROFILE_BIO_MAX_LENGTH = 280;

export interface EditableProfileFormData {
  name: string;
  bio: string;
}

export interface ProfileUpdatePayload {
  name?: string;
  bio?: string | null;
}

const CONTROL_CHARACTERS_PATTERN = /[\u0000-\u0008\u000B-\u001F\u007F]/g;
const COLLAPSIBLE_WHITESPACE_PATTERN = /\s+/g;
const EXTRA_NEWLINES_PATTERN = /\n{3,}/g;

const clampCharacters = (value: string, maxLength: number) =>
  Array.from(value).slice(0, maxLength).join("");

const normalizeText = (value: string) =>
  value.replace(/\r\n?/g, "\n").replace(CONTROL_CHARACTERS_PATTERN, "");

const normalizeSingleLineText = (value: string) =>
  normalizeText(value).replace(COLLAPSIBLE_WHITESPACE_PATTERN, " ").trim();

const normalizeMultilineText = (value: string) =>
  normalizeText(value)
    .split("\n")
    .map((line) => line.replace(COLLAPSIBLE_WHITESPACE_PATTERN, " ").trim())
    .join("\n")
    .replace(EXTRA_NEWLINES_PATTERN, "\n\n")
    .trim();

export const getCharacterCount = (value: string) => Array.from(value).length;

export const sanitizeUsernameInput = (value: string) =>
  clampCharacters(normalizeSingleLineText(value), USERNAME_MAX_LENGTH).trim();

export const sanitizeProfileName = (value: string) =>
  clampCharacters(normalizeSingleLineText(value), PROFILE_NAME_MAX_LENGTH).trim();

export const sanitizeProfileBioInput = (value: string) =>
  clampCharacters(normalizeText(value), PROFILE_BIO_MAX_LENGTH);

export const sanitizeProfileBio = (value: string) =>
  clampCharacters(normalizeMultilineText(value), PROFILE_BIO_MAX_LENGTH);

export const sanitizeProfileFormData = (
  value: Partial<EditableProfileFormData>,
): EditableProfileFormData => ({
  name: sanitizeProfileName(value.name ?? ""),
  bio: sanitizeProfileBio(value.bio ?? ""),
});

export const buildProfileUpdatePayload = (
  nextValue: EditableProfileFormData,
  currentValue: EditableProfileFormData,
): ProfileUpdatePayload => {
  const sanitizedNextValue = sanitizeProfileFormData(nextValue);
  const sanitizedCurrentValue = sanitizeProfileFormData(currentValue);
  const payload: ProfileUpdatePayload = {};

  if (
    sanitizedNextValue.name.length > 0 &&
    sanitizedNextValue.name !== sanitizedCurrentValue.name
  ) {
    payload.name = sanitizedNextValue.name;
  }

  if (sanitizedNextValue.bio !== sanitizedCurrentValue.bio) {
    payload.bio = sanitizedNextValue.bio || null;
  }

  return payload;
};
