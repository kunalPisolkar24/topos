import { useMutation, useQuery } from "@apollo/client/react";
import {
  MeDocument,
  UpdateProfileDocument,
  type MeQuery,
  type MeQueryVariables,
  type UpdateProfileMutation,
  type UpdateProfileMutationVariables,
} from "@/shared/graphql/generated/graphql";
import { MyPostsDocument, type MyPostsQuery, type MyPostsQueryVariables } from "@/shared/graphql/content-documents";

export interface ProfileUpdateInput {
  name?: string;
  bio?: string | null;
  avatarUrl?: string;
  bannerUrl?: string;
}

export const userRepository = {
  useMe(enabled: boolean) {
    return useQuery<MeQuery, MeQueryVariables>(MeDocument, {
      skip: !enabled,
      fetchPolicy: "cache-first",
    });
  },

  useUpdateProfile() {
    return useMutation<UpdateProfileMutation, UpdateProfileMutationVariables>(
      UpdateProfileDocument,
    );
  },

  useMyPosts(page = 1, limit = 6) {
    return useQuery<MyPostsQuery, MyPostsQueryVariables>(MyPostsDocument, {
      variables: { page, limit },
      notifyOnNetworkStatusChange: true,
    });
  },
};
