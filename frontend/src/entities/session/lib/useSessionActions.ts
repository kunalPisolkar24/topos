import { useApolloClient } from "@apollo/client/react";
import type { UserCoreFragment } from "@/shared/graphql/generated/graphql";
import { authenticateSession, logoutSession } from "./session";

export function useSessionActions() {
  const client = useApolloClient();
  return {
    authenticate: (token: string, user: UserCoreFragment) =>
      authenticateSession(client, token, user),
    logout: () => logoutSession(client),
  };
}
