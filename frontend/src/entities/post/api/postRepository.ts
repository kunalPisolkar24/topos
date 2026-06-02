import { useApolloClient } from "@apollo/client/react";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  CreatePostDocument,
  DeletePostDocument,
  GeneratePostContentDocument,
  GenerateTagsDocument,
  PostDocument,
  PostsByTagDocument,
  PostsDocument,
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
  type PostQuery,
  type PostQueryVariables,
  type PostsByTagQuery,
  type PostsByTagQueryVariables,
  type PostsQuery,
  type PostsQueryVariables,
  type SearchPostsQuery,
  type SearchPostsQueryVariables,
  type UpdatePostInput,
  type UpdatePostMutation,
  type UpdatePostMutationVariables,
} from "@/shared/graphql/content-documents";
import { POST_LIST_QUERY_NAMES } from "@/shared/api/refetchLists";

export const postRepository = {
  useList({ page = 1, limit = 6 }: { page?: number; limit?: number } = {}) {
    return useQuery<PostsQuery, PostsQueryVariables>(PostsDocument, {
      variables: { page, limit },
      notifyOnNetworkStatusChange: true,
    });
  },

  useListByTag(tag: string, { page = 1, limit = 6 }: { page?: number; limit?: number } = {}) {
    return useQuery<PostsByTagQuery, PostsByTagQueryVariables>(PostsByTagDocument, {
      variables: { tag, page, limit },
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
      { refetchQueries: POST_LIST_QUERY_NAMES },
    );
  },

  useUpdate() {
    return useMutation<UpdatePostMutation, UpdatePostMutationVariables>(
      UpdatePostDocument,
      { refetchQueries: POST_LIST_QUERY_NAMES },
    );
  },

  useDelete() {
    return useMutation<DeletePostMutation, DeletePostMutationVariables>(
      DeletePostDocument,
      { refetchQueries: POST_LIST_QUERY_NAMES },
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
