import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import {
  ApprovePostDraftDocument,
  CreatePostDraftDocument,
  DeletePostDraftDocument,
  MyPostDraftsDocument,
  PostDraftsDocument,
  RejectPostDraftDocument,
  type ApprovePostDraftMutation,
  type ApprovePostDraftMutationVariables,
  type CreatePostDraftMutation,
  type CreatePostDraftMutationVariables,
  type DeletePostDraftMutation,
  type DeletePostDraftMutationVariables,
  type DraftEditsInput,
  type MyPostDraftsQuery,
  type MyPostDraftsQueryVariables,
  type PostDraftsQuery,
  type PostDraftsQueryVariables,
  type RejectPostDraftMutation,
  type RejectPostDraftMutationVariables,
} from "@/shared/graphql/content-documents";

const PAGE_LIMIT = 6;

export interface DraftRepository {
  usePostDrafts(page: number, opts?: { skip?: boolean }): ReturnType<typeof useQuery<PostDraftsQuery, PostDraftsQueryVariables>>;
  useMyPostDrafts(page: number, opts?: { skip?: boolean }): ReturnType<typeof useQuery<MyPostDraftsQuery, MyPostDraftsQueryVariables>>;
  useCreateDraft(): ReturnType<typeof useMutation<CreatePostDraftMutation, CreatePostDraftMutationVariables>>;
  useApproveDraft(): ReturnType<typeof useMutation<ApprovePostDraftMutation, ApprovePostDraftMutationVariables>>;
  useRejectDraft(): ReturnType<typeof useMutation<RejectPostDraftMutation, RejectPostDraftMutationVariables>>;
  useDeleteDraft(): ReturnType<typeof useMutation<DeletePostDraftMutation, DeletePostDraftMutationVariables>>;
  createDraftOnce(client: ReturnType<typeof useApolloClient>, prompt: string): Promise<unknown>;
}

export const draftRepository: DraftRepository = {
  usePostDrafts(page = 1, opts) {
    return useQuery<PostDraftsQuery, PostDraftsQueryVariables>(PostDraftsDocument, {
      variables: { page, limit: PAGE_LIMIT },
      skip: opts?.skip,
    });
  },

  useMyPostDrafts(page = 1, opts) {
    return useQuery<MyPostDraftsQuery, MyPostDraftsQueryVariables>(MyPostDraftsDocument, {
      variables: { page, limit: PAGE_LIMIT },
      skip: opts?.skip,
    });
  },

  useCreateDraft() {
    return useMutation<CreatePostDraftMutation, CreatePostDraftMutationVariables>(CreatePostDraftDocument);
  },

  useApproveDraft() {
    return useMutation<ApprovePostDraftMutation, ApprovePostDraftMutationVariables>(ApprovePostDraftDocument);
  },

  useRejectDraft() {
    return useMutation<RejectPostDraftMutation, RejectPostDraftMutationVariables>(RejectPostDraftDocument);
  },

  useDeleteDraft() {
    return useMutation<DeletePostDraftMutation, DeletePostDraftMutationVariables>(DeletePostDraftDocument);
  },

  async createDraftOnce(client, prompt) {
    return client.mutate<CreatePostDraftMutation, CreatePostDraftMutationVariables>({
      mutation: CreatePostDraftDocument,
      variables: { prompt },
    });
  },
};

export type { DraftEditsInput };
