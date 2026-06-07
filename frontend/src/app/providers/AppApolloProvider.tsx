import { ApolloProvider } from "@apollo/client/react";
import type { ApolloClient } from "@apollo/client";
import type { PropsWithChildren } from "react";
import { useRef } from "react";
import { createApolloClient } from "@/shared/api";
import { env } from "@/shared/config/env";
import {
  handleUnauthorizedSession,
  useSessionStore,
} from "@/entities/session";

export function AppApolloProvider({ children }: PropsWithChildren) {
  const clientRef = useRef<ApolloClient | null>(null);

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
