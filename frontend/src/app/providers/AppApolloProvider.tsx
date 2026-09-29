import { ApolloProvider } from "@apollo/client/react";
import type { ApolloClient } from "@apollo/client";
import type { PropsWithChildren } from "react";
import { useRef } from "react";
import { createApolloClient } from "@/shared/api";
import { env, hasValidEnv, getEnvError } from "@/shared/config/env";
import { logger } from "@/shared/lib/logger";
import {
  handleUnauthorizedSession,
  useSessionStore,
} from "@/entities/session";

export function AppApolloProvider({ children }: PropsWithChildren) {
  const clientRef = useRef<ApolloClient | null>(null);

  if (!hasValidEnv) {
    logger.error("Missing VITE_GRAPHQL_URL", getEnvError());
    return (
      <div
        role="alert"
        className="flex min-h-screen items-center justify-center p-6 text-center"
      >
        <div className="max-w-md space-y-2">
          <h1 className="text-lg font-semibold">Configuration error</h1>
          <p className="text-sm text-muted-foreground">
            VITE_GRAPHQL_URL is not configured. Please set it in your
            environment and reload the application.
          </p>
        </div>
      </div>
    );
  }

  if (clientRef.current === null) {
    clientRef.current = createApolloClient({
      uri: env.VITE_GRAPHQL_URL,
      getToken: () => useSessionStore.getState().token,
      onUnauthorized: () => handleUnauthorizedSession(clientRef.current!),
    });
  }

  return (
    <ApolloProvider client={clientRef.current}>{children}</ApolloProvider>
  );
}
