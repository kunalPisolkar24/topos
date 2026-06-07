export {
  authenticateSession,
  bootstrapSession,
  handleUnauthorizedSession,
  logoutSession,
  resetSessionBootstrapForTests,
  writeCurrentUserToCache,
} from "./lib/session";
export {
  sessionStoreActions,
  useSessionStore,
} from "./store/session-store";
export {
  initialSessionState,
  localStorageSessionAdapter,
  SESSION_TOKEN_STORAGE_KEY,
  type AuthStatus,
  type SessionSnapshot,
  type SessionStorageAdapter,
} from "./model/session";

import { useQuery } from "@apollo/client/react";
import { useApolloClient } from "@apollo/client/react";
import { useSessionStore } from "./store/session-store";
import {
  MeDocument,
  type MeQuery,
  type UserCoreFragment,
} from "@/shared/graphql/generated/graphql";
import {
  authenticateSession,
  logoutSession,
} from "./lib/session";

export function useCurrentUser() {
  const status = useSessionStore((state) => state.status);
  const hasHydrated = useSessionStore((state) => state.hasHydrated);

  const query = useQuery<MeQuery, { id?: string }>(MeDocument, {
    skip: !hasHydrated || status !== "authenticated",
    fetchPolicy: "cache-first",
  });

  return {
    user: query.data?.me ?? null,
    loading:
      !hasHydrated ||
      status === "hydrating" ||
      (status === "authenticated" && query.loading),
    error: query.error,
  };
}

export function useSessionActions() {
  const client = useApolloClient();
  return {
    authenticate: (token: string, user: UserCoreFragment) =>
      authenticateSession(client, token, user),
    logout: () => logoutSession(client),
  };
}

export { useSessionStore as default } from "./store/session-store";
