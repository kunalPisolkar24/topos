import { gql } from "@apollo/client";
import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import {
  ApprovePostDraftDocument,
  CreateContentDraftDocument,
  CreatePostDraftDocument,
  DeletePostDraftDocument,
  MyPostDraftsDocument,
  PostDraftsDocument,
  RejectPostDraftDocument,
  ResubmitContentDraftDocument,
  type ApprovePostDraftMutation,
  type ApprovePostDraftMutationVariables,
  type CreateContentDraftMutation,
  type CreateContentDraftMutationVariables,
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
  type ResubmitContentDraftMutation,
  type ResubmitContentDraftMutationVariables,
} from "@/shared/graphql/content-documents";

const PAGE_LIMIT = 6;

const POST_DRAFT_STATUS_FRAGMENT = gql`
  fragment PostDraftStatus on PostDraft {
    status
  }
`;

export interface DraftRepository {
  usePostDrafts(page: number, opts?: { skip?: boolean }): ReturnType<typeof useQuery<PostDraftsQuery, PostDraftsQueryVariables>>;
  useMyPostDrafts(page: number, opts?: { skip?: boolean }): ReturnType<typeof useQuery<MyPostDraftsQuery, MyPostDraftsQueryVariables>>;
  useCreateDraft(): ReturnType<typeof useMutation<CreatePostDraftMutation, CreatePostDraftMutationVariables>>;
  useCreateContentDraft(): ReturnType<typeof useMutation<CreateContentDraftMutation, CreateContentDraftMutationVariables>>;
  useResubmitContentDraft(): ReturnType<typeof useMutation<ResubmitContentDraftMutation, ResubmitContentDraftMutationVariables>>;
  useApproveDraft(): ReturnType<typeof useMutation<ApprovePostDraftMutation, ApprovePostDraftMutationVariables>>;
  useRejectDraft(): ReturnType<typeof useMutation<RejectPostDraftMutation, RejectPostDraftMutationVariables>>;
  useDeleteDraft(): ReturnType<typeof useMutation<DeletePostDraftMutation, DeletePostDraftMutationVariables>>;
  applyDraftStatusOptimistic(client: ReturnType<typeof useApolloClient>, draftId: string, status: string): string | undefined;
  readDraftStatus(client: ReturnType<typeof useApolloClient>, draftId: string): string | undefined;
  rollbackDraftStatusIfOptimistic(client: ReturnType<typeof useApolloClient>, draftId: string, optimisticStatus: string, previousStatus: string | undefined): void;
  refreshDraftLists(client: ReturnType<typeof useApolloClient>): Promise<void>;
}

export const draftRepository: DraftRepository = {
  usePostDrafts(page = 1, opts) {
    return useQuery<PostDraftsQuery, PostDraftsQueryVariables>(PostDraftsDocument, {
      variables: { page, limit: PAGE_LIMIT },
      skip: opts?.skip,
      fetchPolicy: "cache-and-network",
      notifyOnNetworkStatusChange: true,
    });
  },

  useMyPostDrafts(page = 1, opts) {
    return useQuery<MyPostDraftsQuery, MyPostDraftsQueryVariables>(MyPostDraftsDocument, {
      variables: { page, limit: PAGE_LIMIT },
      skip: opts?.skip,
      fetchPolicy: "cache-and-network",
      notifyOnNetworkStatusChange: true,
    });
  },

  useCreateDraft() {
    return useMutation<CreatePostDraftMutation, CreatePostDraftMutationVariables>(CreatePostDraftDocument);
  },

  useCreateContentDraft() {
    return useMutation<CreateContentDraftMutation, CreateContentDraftMutationVariables>(CreateContentDraftDocument);
  },

  useResubmitContentDraft() {
    return useMutation<ResubmitContentDraftMutation, ResubmitContentDraftMutationVariables>(ResubmitContentDraftDocument);
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

  applyDraftStatusOptimistic(
    client: ReturnType<typeof useApolloClient>,
    draftId: string,
    status: string,
  ): string | undefined {
    const ref = client.cache.identify({ __typename: "PostDraft", id: draftId });
    if (!ref) return undefined;
    let previous: string | undefined;
    client.cache.modify({
      id: ref,
      fields: {
        status: (existing) => {
          previous = existing as string;
          return status;
        },
      },
    });
    return previous;
  },

  readDraftStatus(
    client: ReturnType<typeof useApolloClient>,
    draftId: string,
  ): string | undefined {
    const ref = client.cache.identify({ __typename: "PostDraft", id: draftId });
    if (!ref) return undefined;
    const snapshot = client.cache.readFragment<{ status: string }>({
      id: ref,
      fragment: POST_DRAFT_STATUS_FRAGMENT,
    });
    return snapshot?.status;
  },

  rollbackDraftStatusIfOptimistic(
    client: ReturnType<typeof useApolloClient>,
    draftId: string,
    optimisticStatus: string,
    previousStatus: string | undefined,
  ): void {
    if (previousStatus === undefined) return;
    const status = draftRepository.readDraftStatus(client, draftId);
    if (status !== optimisticStatus) return;
    const ref = client.cache.identify({ __typename: "PostDraft", id: draftId });
    if (!ref) return;
    client.cache.modify({
      id: ref,
      fields: { status: () => previousStatus },
    });
  },

  async refreshDraftLists(client: ReturnType<typeof useApolloClient>): Promise<void> {
    await client.refetchQueries({ include: ["PostDrafts", "MyPostDrafts"] });
  },
};

export type { DraftEditsInput };
