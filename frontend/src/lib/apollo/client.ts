import {
  ApolloClient,
  HttpLink,
  InMemoryCache,
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
} from "@/lib/apollo/auth";
import { handleUnauthorizedSession, registerApolloClient } from "./unauthorized";
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
  cache: new InMemoryCache({
    typePolicies: {
      Post: {
        keyFields: ["id"],
      },
      Tag: {
        keyFields: ["id"],
      },
      SearchResult: {
        keyFields: false,
      },
      User: {
        keyFields: ["id"],
        fields: {
          posts: {
            keyArgs: ["page", "limit"],
            merge: false,
          },
        },
      },
      Query: {
        fields: {
          me: {
            merge: false,
          },
          post: {
            keyArgs: ["id"],
            merge: false,
          },
          posts: {
            keyArgs: ["page", "limit"],
            merge: false,
          },
          postsByTag: {
            keyArgs: ["tag", "page", "limit"],
            merge: false,
          },
          searchPosts: {
            keyArgs: ["query", "page", "limit"],
            merge: false,
          },
          tags: {
            keyArgs: ["query", "limit"],
            merge: false,
          },
        },
      },
    },
  }),
});

registerApolloClient(apolloClient);
