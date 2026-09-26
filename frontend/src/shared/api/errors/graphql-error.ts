import { CombinedGraphQLErrors } from "@apollo/client/errors";

export function getGraphQLErrorCodes(error: unknown): string[] {
  if (CombinedGraphQLErrors.is(error)) {
    return error.errors.map((entry) => entry.extensions?.code).filter((code): code is string => typeof code === "string" && code.length > 0);
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "extensions" in error &&
    typeof error.extensions === "object" &&
    error.extensions !== null &&
    "code" in error.extensions &&
    typeof error.extensions.code === "string"
  ) {
    return [error.extensions.code];
  }

  return [];
}

export function getGraphQLErrorMessage(
  error: unknown,
  fallbackMessage: string,
) {
  if (CombinedGraphQLErrors.is(error)) {
    const message = error.errors
      .map((entry) => entry.message.trim())
      .filter(Boolean)
      .join(" ");

    if (message) {
      return message;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message;
  }

  return fallbackMessage;
}
