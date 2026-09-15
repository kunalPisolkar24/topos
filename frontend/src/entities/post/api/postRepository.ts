import { useApolloClient } from "@apollo/client/react";
import { useMutation, useQuery } from "@apollo/client/react";
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
  type CreatePostInput,
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
  type UpdatePostInput,
  type UpdatePostMutation,
  type UpdatePostMutationVariables,
} from "@/shared/graphql/content-documents";
export const postRepository = {
  useList({ page = 1, limit = 6, skip = false }: { page?: number; limit?: number; skip?: boolean } = {}) {
    return useQuery<PostsQuery, PostsQueryVariables>(PostsDocument, {
      variables: { page, limit },
      skip,
      notifyOnNetworkStatusChange: true,
    });
  },

  useListByTag(tag: string, { page = 1, limit = 6, skip = false }: { page?: number; limit?: number; skip?: boolean } = {}) {
    return useQuery<PostsByTagQuery, PostsByTagQueryVariables>(PostsByTagDocument, {
      variables: { tag, page, limit },
      skip: skip || !tag,
      notifyOnNetworkStatusChange: true,
    });
  },

  useSearch(query: string, page = 1, limit = 6) {
    return useQuery<SearchPostsQuery, SearchPostsQueryVariables>(SearchPostsDocument, {
      variables: { query, page, limit },
      skip: query.length === 0,
      notifyOnNetworkStatusChange: true,
    });
  },

  useGet(id: string) {
    return useQuery<PostQuery, PostQueryVariables>(PostDocument, {
      variables: { id },
      skip: !id,
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

  async createOnce(client: ReturnType<typeof useApolloClient>, input: CreatePostInput) {
    return client.mutate<CreatePostMutation, CreatePostMutationVariables>({
      mutation: CreatePostDocument,
      variables: { input },
    });
  },

  async updateOnce(
    client: ReturnType<typeof useApolloClient>,
    id: string,
    input: UpdatePostInput,
  ) {
    return client.mutate<UpdatePostMutation, UpdatePostMutationVariables>({
      mutation: UpdatePostDocument,
      variables: { id, input },
    });
  },

  async deleteOnce(client: ReturnType<typeof useApolloClient>, id: string) {
    return client.mutate<DeletePostMutation, DeletePostMutationVariables>({
      mutation: DeletePostDocument,
      variables: { id },
    });
  },
};
