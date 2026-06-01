import type { ApolloClient } from "@apollo/client";
import {
  MeDocument,
  type MeQuery,
  type UserCoreFragment,
} from "@/shared/graphql/generated/graphql";
import { sessionStoreActions } from "@/stores/session-store";

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

export async function logoutSession(
  client: ApolloClient,
) {
  sessionStoreActions.markAnonymous();
  await client.clearStore();
}

export function bootstrapSession(
  client: ApolloClient,
) {
  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  if (sessionStoreActions === undefined) {
    return Promise.resolve();
  }

  bootstrapPromise = (async () => {
    const token = sessionStoreActions.initializeFromStorage();

    if (!token) {
      return;
    }

    try {
      const result = await client.query({
        query: MeDocument,
        fetchPolicy: "network-only",
      });

      if (result.data?.me) {
        sessionStoreActions.markAuthenticated(token);
        writeCurrentUserToCache(client, result.data.me);
        return;
      }
    } catch (error) {
      console.error("Session bootstrap failed", error);
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
