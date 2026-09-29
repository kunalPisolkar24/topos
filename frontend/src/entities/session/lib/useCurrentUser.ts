import { useQuery } from "@apollo/client/react";
import { useSessionStore } from "../store/session-store";
import {
  MeDocument,
  type MeQuery,
} from "@/shared/graphql/generated/graphql";

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
