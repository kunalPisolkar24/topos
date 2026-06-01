import {
  ApolloClient,
  HttpLink,
  from,
} from "@apollo/client";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { onError } from "@apollo/client/link/error";
import { setContext } from "@apollo/client/link/context";
import { buildApolloCache } from "./policies";
import {
  buildAuthHeaders,
  hasUnauthorizedGraphQLError,
  hasUnauthorizedNetworkError,
} from "./links/auth";

export interface ApolloClientDependencies {
  uri: string;
  getToken: () => string | null;
  onUnauthorized: () => void | Promise<void>;
}

export const createApolloClient = (
  deps: ApolloClientDependencies,
): ApolloClient => {
  const authLink = setContext((_, { headers }) => ({
    headers: { ...headers, ...buildAuthHeaders(deps.getToken()) },
  }));

  const errorLink = onError(({ error }) => {
    if (CombinedGraphQLErrors.is(error)) {
      if (hasUnauthorizedGraphQLError(error.errors)) {
        void deps.onUnauthorized();
      }
      return;
    }

    if (
      hasUnauthorizedNetworkError(
        error as { statusCode?: number; status?: number } | null,
      )
    ) {
      void deps.onUnauthorized();
    }
  });

  return new ApolloClient({
    link: from([
      errorLink,
      authLink,
      new HttpLink({ uri: deps.uri }),
    ]),
    cache: buildApolloCache(),
  });
};
