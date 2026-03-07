import { useQuery } from "@apollo/client/react";
import { MeDocument } from "@/graphql/generated/graphql";
import { useSessionStore } from "@/stores/session-store";

export function useCurrentUser() {
  const status = useSessionStore((state) => state.status);
  const hasHydrated = useSessionStore((state) => state.hasHydrated);

  const query = useQuery(MeDocument, {
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
