import { useQuery } from "@apollo/client/react";
import {
  UserDocument,
  type UserQuery,
} from "@/shared/graphql/generated/graphql";

// useReviewerIdentity resolves a reviewer's public profile through the
// gateway in every env (preview MSW answers from its local user store).
export function useReviewerIdentity(userId?: string | null) {
  const query = useQuery<UserQuery>(UserDocument, {
    variables: { id: userId ?? "" },
    skip: !userId,
    fetchPolicy: "cache-first",
  });

  return {
    user: query.data?.user ?? null,
    loading: query.loading,
  };
}
