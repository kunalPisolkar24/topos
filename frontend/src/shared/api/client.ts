import {
  ApolloClient,
  HttpLink,
  from,
} from "@apollo/client";
import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { onError } from "@apollo/client/link/error";
import { RetryLink } from "@apollo/client/link/retry";
import { setContext } from "@apollo/client/link/context";
import { buildApolloCache } from "./apollo/cache";
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

const isMutationOperation = (operation: { query: { definitions: ReadonlyArray<{ kind: string; operation?: string }> } }): boolean =>
  operation.query.definitions.some(
    (def) => def.kind === "OperationDefinition" && def.operation === "mutation",
  );

function isTimeoutError(error: unknown): boolean {
  if (!error) return false;
  const err = error as { name?: string; message?: string; statusCode?: number; status?: number };
  if (err.name === "TimeoutError" || err.name === "AbortError" || err.name === "BootstrapTimeoutError") {
    return true;
  }
  if (typeof err.message === "string" && /timeout|timed out|aborted/i.test(err.message)) {
    return true;
  }
  return false;
}

const buildRetryLink = () =>
  new RetryLink({
    delay: { initial: 300, max: 3000, jitter: true },
    attempts: {
      max: 3,
      retryIf: (error, operation) => {
        if (!error) return false;
        if (operation && isMutationOperation(operation as never)) return false;
        if (hasUnauthorizedNetworkError(error)) return false;
        if (isTimeoutError(error)) return false;
        if (CombinedGraphQLErrors.is(error)) {
          if (hasUnauthorizedGraphQLError(error.errors)) return false;
          return false;
        }
        return true;
      },
    },
  });

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

    if (hasUnauthorizedNetworkError(error)) {
      void deps.onUnauthorized();
    }
  });

  return new ApolloClient({
    link: from([
      buildRetryLink(),
      errorLink,
      authLink,
      new HttpLink({ uri: deps.uri }),
    ]),
    cache: buildApolloCache(),
  });
};
