import type { ApolloClient } from "@apollo/client";
import { sessionStoreActions } from "@/stores/session-store";

let clientRef: ApolloClient | null = null;

export function registerApolloClient(client: ApolloClient) {
  clientRef = client;
}

export async function handleUnauthorizedSession() {
  sessionStoreActions.markAnonymous();

  if (clientRef) {
    await clientRef.clearStore();
  }
}
