import { CombinedGraphQLErrors } from "@apollo/client/errors";

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
