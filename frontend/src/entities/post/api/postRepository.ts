import { gql } from "@apollo/client";
import { useApolloClient } from "@apollo/client/react";
import { useMutation, useQuery } from "@apollo/client/react";
import { refreshPostListQueries } from "@/shared/api";
import {
  CreatePostDocument,
  DeletePostDocument,
  GeneratePostContentDocument,
  GenerateTagsDocument,
  LikePostDocument,
  PostDocument,
  PostsByTagDocument,
  PostsDocument,
  RecommendedPostsDocument,
  RecordPostViewDocument,
  SavePostDocument,
  SearchPostsDocument,
  UpdatePostDocument,
  type CreatePostMutation,
  type CreatePostMutationVariables,
  type DeletePostMutation,
  type DeletePostMutationVariables,
  type GeneratePostContentMutation,
  type GeneratePostContentMutationVariables,
  type GenerateTagsMutation,
  type GenerateTagsMutationVariables,
  type LikePostMutation,
  type LikePostMutationVariables,
  type PostQuery,
  type PostQueryVariables,
  type PostsByTagQuery,
  type PostsByTagQueryVariables,
  type PostsQuery,
  type PostsQueryVariables,
  type RecommendedPostsQuery,
  type RecommendedPostsQueryVariables,
  type RecordPostViewMutation,
  type RecordPostViewMutationVariables,
  type SavePostMutation,
  type SavePostMutationVariables,
  type SearchPostsQuery,
  type SearchPostsQueryVariables,
  type UpdatePostMutation,
  type UpdatePostMutationVariables,
} from "@/shared/graphql/content-documents";
const POST_INTERACTION_FRAGMENT = gql`
  fragment PostInteractionState on Post {
    likedByMe
    savedByMe
  }
`;

export const postRepository = {
  useList({ page = 1, limit = 6, skip = false }: { page?: number; limit?: number; skip?: boolean } = {}) {
    return useQuery<PostsQuery, PostsQueryVariables>(PostsDocument, {
      variables: { page, limit },
      skip,
      fetchPolicy: "cache-and-network",
      notifyOnNetworkStatusChange: true,
    });
  },

  useListByTag(tag: string, { page = 1, limit = 6, skip = false }: { page?: number; limit?: number; skip?: boolean } = {}) {
    return useQuery<PostsByTagQuery, PostsByTagQueryVariables>(PostsByTagDocument, {
      variables: { tag, page, limit },
      skip: skip || !tag,
      fetchPolicy: "cache-and-network",
      notifyOnNetworkStatusChange: true,
    });
  },

  useSearch(query: string, page = 1, limit = 6) {
    return useQuery<SearchPostsQuery, SearchPostsQueryVariables>(SearchPostsDocument, {
      variables: { query, page, limit },
      skip: query.length === 0,
      fetchPolicy: "cache-and-network",
      notifyOnNetworkStatusChange: true,
    });
  },

  useGet(id: string) {
    return useQuery<PostQuery, PostQueryVariables>(PostDocument, {
      variables: { id },
      skip: !id,
      fetchPolicy: "cache-and-network",
      notifyOnNetworkStatusChange: true,
    });
  },

  useCreate() {
    return useMutation<CreatePostMutation, CreatePostMutationVariables>(
      CreatePostDocument,
    );
  },

  useUpdate() {
    return useMutation<UpdatePostMutation, UpdatePostMutationVariables>(
      UpdatePostDocument,
    );
  },

  useDelete() {
    return useMutation<DeletePostMutation, DeletePostMutationVariables>(
      DeletePostDocument,
    );
  },

  useGenerateTags() {
    return useMutation<GenerateTagsMutation, GenerateTagsMutationVariables>(
      GenerateTagsDocument,
    );
  },

  useGenerateDraft() {
    return useMutation<
      GeneratePostContentMutation,
      GeneratePostContentMutationVariables
    >(GeneratePostContentDocument);
  },

  useRecommended({
    page = 1,
    limit = 6,
    mode = "DEFAULT" as RecommendedPostsQueryVariables["mode"],
    seed,
    skip = false,
  }: {
    page?: number;
    limit?: number;
    mode?: RecommendedPostsQueryVariables["mode"];
    seed?: number;
    skip?: boolean;
  } = {}) {
    return useQuery<RecommendedPostsQuery, RecommendedPostsQueryVariables>(RecommendedPostsDocument, {
      variables: { page, limit, mode, seed },
      skip,
      fetchPolicy: "cache-and-network",
      notifyOnNetworkStatusChange: true,
    });
  },

  useRecordView() {
    return useMutation<RecordPostViewMutation, RecordPostViewMutationVariables>(RecordPostViewDocument);
  },

  useLike() {
    return useMutation<LikePostMutation, LikePostMutationVariables>(LikePostDocument);
  },

  useSave() {
    return useMutation<SavePostMutation, SavePostMutationVariables>(SavePostDocument);
  },

  async searchOnce(
    client: ReturnType<typeof useApolloClient>,
    query: string,
    page = 1,
    limit = 6,
  ) {
    return client.query<SearchPostsQuery, SearchPostsQueryVariables>({
      query: SearchPostsDocument,
      variables: { query, page, limit },
      fetchPolicy: "no-cache",
    });
  },

  async recommendedOnce(
    client: ReturnType<typeof useApolloClient>,
    page = 1,
    limit = 6,
  ) {
    return client.query<RecommendedPostsQuery, RecommendedPostsQueryVariables>({
      query: RecommendedPostsDocument,
      variables: { page, limit },
      fetchPolicy: "cache-first",
    });
  },

  readInteractionState(
    client: ReturnType<typeof useApolloClient>,
    postId: string,
    fallback: { liked: boolean; saved: boolean },
  ): { liked: boolean; saved: boolean } {
    const postRef = client.cache.identify({ __typename: "Post", id: postId });
    if (postRef) {
      const fragment = client.cache.readFragment<{
        likedByMe: boolean;
        savedByMe: boolean;
      }>({
        id: postRef,
        fragment: POST_INTERACTION_FRAGMENT,
      });
      if (fragment) return { liked: fragment.likedByMe, saved: fragment.savedByMe };
    }
    return fallback;
  },

  writeLikedState(
    client: ReturnType<typeof useApolloClient>,
    postId: string,
    liked: boolean,
  ): void {
    const postRef = client.cache.identify({ __typename: "Post", id: postId });
    if (!postRef) return;
    client.cache.modify({
      id: postRef,
      fields: { likedByMe: () => liked },
    });
  },

  writeSavedState(
    client: ReturnType<typeof useApolloClient>,
    postId: string,
    saved: boolean,
  ): void {
    const postRef = client.cache.identify({ __typename: "Post", id: postId });
    if (!postRef) return;
    client.cache.modify({
      id: postRef,
      fields: { savedByMe: () => saved },
    });
  },

  async refreshLists(
    client: ReturnType<typeof useApolloClient>,
    options?: { postId?: string },
  ): Promise<void> {
    await refreshPostListQueries(client, options);
  },
};
