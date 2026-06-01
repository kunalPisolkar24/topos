import {
  ApolloClient,
  HttpLink,
  from,
} from "@apollo/client";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { onError } from "@apollo/client/link/error";
import { setContext } from "@apollo/client/link/context";
import { env } from "@/lib/env";
import {
  buildAuthHeaders,
  hasUnauthorizedGraphQLError,
  hasUnauthorizedNetworkError,
} from "@/shared/api/links/auth";
import { handleUnauthorizedSession, registerApolloClient } from "@/shared/api/links/unauthorized";
import { buildApolloCache } from "@/shared/api/policies";
import { useSessionStore } from "@/stores/session-store";

const authLink = setContext((_, { headers }) => {
  const token = useSessionStore.getState().token;

  return {
    headers: {
      ...headers,
      ...buildAuthHeaders(token),
    },
  };
});

const errorLink = onError(({ error }) => {
  if (CombinedGraphQLErrors.is(error)) {
    if (hasUnauthorizedGraphQLError(error.errors)) {
      void handleUnauthorizedSession();
    }
    return;
  }

  if (
    hasUnauthorizedNetworkError(
      error as { statusCode?: number; status?: number } | null,
    )
  ) {
    void handleUnauthorizedSession();
  }
});

export const apolloClient = new ApolloClient({
  link: from([
    errorLink,
    authLink,
    new HttpLink({
      uri: env.VITE_GRAPHQL_URL,
    }),
  ]),
  cache: buildApolloCache(),
});

registerApolloClient(apolloClient);
