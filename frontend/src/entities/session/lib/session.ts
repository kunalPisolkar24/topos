import type { ApolloClient } from "@apollo/client";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import {
  MeDocument,
  type MeQuery,
  type UserCoreFragment,
} from "@/shared/graphql/generated/graphql";
import { logger } from "@/shared/lib/logger";
import {
  hasUnauthorizedGraphQLError,
  hasUnauthorizedNetworkError,
} from "@/shared/api/links/auth";
import { sessionStoreActions } from "../store/session-store";

export const BOOTSTRAP_TIMEOUT_MS = 8000;

export class BootstrapTimeoutError extends Error {
  constructor(message = `Session bootstrap timed out after ${BOOTSTRAP_TIMEOUT_MS}ms`) {
    super(message);
    this.name = "BootstrapTimeoutError";
  }
}

function isTimeoutError(error: unknown): boolean {
  if (!error) return false;
  const err = error as { name?: string; message?: string };
  return (
    err.name === "BootstrapTimeoutError" ||
    err.name === "TimeoutError" ||
    err.name === "AbortError" ||
    /timed out|timeout|aborted/i.test(err.message ?? "")
  );
}

let bootstrapPromise: Promise<void> | null = null;

export function writeCurrentUserToCache(
  client: ApolloClient,
  user: UserCoreFragment | null,
) {
  client.writeQuery<MeQuery>({
    query: MeDocument,
    data: {
      me: user,
    },
  });
}

export function authenticateSession(
  client: ApolloClient,
  token: string,
  user: UserCoreFragment,
) {
  sessionStoreActions.markAuthenticated(token);
  writeCurrentUserToCache(client, user);
}

export async function logoutSession(client: ApolloClient) {
  sessionStoreActions.markAnonymous();
  await client.clearStore();
}

export async function handleUnauthorizedSession(client: ApolloClient) {
  await logoutSession(client);
}

export function bootstrapSession(
  client: ApolloClient,
  timeoutMs: number = BOOTSTRAP_TIMEOUT_MS,
) {
  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  bootstrapPromise = (async () => {
    const token = sessionStoreActions.initializeFromStorage();

    if (!token) {
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const controller =
      typeof AbortController !== "undefined" ? new AbortController() : null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        const err = new BootstrapTimeoutError(
          `Session bootstrap timed out after ${timeoutMs}ms`,
        );
        if (controller) {
          try {
            controller.abort(err);
          } catch {
            // ignore abort errors in environments without support for reason
          }
        }
        reject(err);
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([
        client.query({
          query: MeDocument,
          fetchPolicy: "network-only",
          context: controller
            ? { fetchOptions: { signal: controller.signal } }
            : undefined,
        }),
        timeoutPromise,
      ]);

      if (timeoutId) clearTimeout(timeoutId);

      if (result.data?.me) {
        sessionStoreActions.markAuthenticated(token);
        writeCurrentUserToCache(client, result.data.me);
        return;
      }
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      logger.error("Session bootstrap failed", error);
      if (isTimeoutError(error)) {
        // Timeout should not be retried silently; surface as logout so
        // route guards can show retry UI instead of infinite spinner.
        // Keep token for retry but ensure hydrating is resolved.
        // We treat timeout similarly to transient error: keep session
        // optimistically authenticated to avoid forced logout, but
        // ensure hasHydrated becomes true via markAuthenticated.
        // If token should be preserved for retry, we mark authenticated
        // so ProtectedRoute can decide to show error via its own timeout.
        sessionStoreActions.markAuthenticated(token);
        return;
      }
      const isUnauthorized =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hasUnauthorizedNetworkError(error as any) ||
        (CombinedGraphQLErrors.is(error) &&
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          hasUnauthorizedGraphQLError((error as any).errors));
      if (isUnauthorized) {
        await logoutSession(client);
        return;
      }
      sessionStoreActions.markAuthenticated(token);
      return;
    }

    await logoutSession(client);
  })().finally(() => {
    bootstrapPromise = null;
  });

  return bootstrapPromise;
}

export function resetSessionBootstrapForTests() {
  bootstrapPromise = null;
}
