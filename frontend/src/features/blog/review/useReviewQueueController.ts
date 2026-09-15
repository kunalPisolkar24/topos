import { useRef, useState } from "react";
import { gql } from "@apollo/client";
import { useApolloClient } from "@apollo/client/react";
import { draftRepository } from "@/entities/draft/api/draftRepository";
import { getGraphQLErrorMessage } from "@/shared/api";
import { useToast } from "@/shared/ui/hooks/useToast";
import { useSessionStore } from "@/entities/session";
import type { DraftEditsInput, PostDraft } from "@/shared/graphql/content-documents";

export type ReviewDialog =
  | { kind: "closed" }
  | { kind: "approve"; draft: PostDraft }
  | { kind: "reject"; draft: PostDraft }
  | { kind: "withdraw"; draft: PostDraft };

export interface PaginatedDraftSection {
  drafts: PostDraft[];
  totalPages: number;
  currentPage: number;
  totalDrafts: number;
}

export interface ReviewQueueController {
  isAuthenticated: boolean;
  community: {
    section: "loading" | "error" | "ready";
    data: PaginatedDraftSection;
    page: number;
    setPage: (page: number) => void;
    refetch: () => void;
  };
  mine: {
    section: "loading" | "error" | "ready";
    data: PaginatedDraftSection;
    page: number;
    setPage: (page: number) => void;
    refetch: () => void;
  };
  dialog: ReviewDialog;
  setDialog: (dialog: ReviewDialog) => void;
  pendingIds: Set<string>;
  isPending: (draftId: string) => boolean;
  approve: (draftId: string, edits: DraftEditsInput) => Promise<void>;
  reject: (draftId: string, reason: string) => Promise<void>;
  withdraw: (draftId: string) => Promise<void>;
}

const emptySection: PaginatedDraftSection = {
  drafts: [],
  totalPages: 0,
  currentPage: 1,
  totalDrafts: 0,
};

const POST_DRAFT_STATUS_FRAGMENT = gql`
  fragment PostDraftStatus on PostDraft {
    status
  }
`;

// useReviewQueueController drives the two-section review page. Status
// flips land optimistically on the normalized PostDraft entity so the
// row reacts instantly, then both lists refetch so reviewed drafts
// leave their queues and any lost race (someone else reviewed first)
// resolves to server truth.
export const useReviewQueueController = (): ReviewQueueController => {
  const client = useApolloClient();
  const { toast } = useToast();
  const isAuthenticated =
    useSessionStore((state) => state.status) === "authenticated";

  const [communityPage, setCommunityPage] = useState(1);
  const [minePage, setMinePage] = useState(1);

  const communityQuery = draftRepository.usePostDrafts(communityPage, { skip: !isAuthenticated });
  const mineQuery = draftRepository.useMyPostDrafts(minePage, { skip: !isAuthenticated });

  const [approveMutation] = draftRepository.useApproveDraft();
  const [rejectMutation] = draftRepository.useRejectDraft();
  const [withdrawMutation] = draftRepository.useDeleteDraft();

  const [dialog, setDialog] = useState<ReviewDialog>({ kind: "closed" });
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set<string>());
  const pendingRef = useRef<Set<string>>(new Set<string>());

  const isPending = (draftId: string) => pendingIds.has(draftId);

  const applyStatus = (draftId: string, status: PostDraft["status"]) => {
    const ref = client.cache.identify({ __typename: "PostDraft", id: draftId });
    if (!ref) return undefined;
    let previous: PostDraft["status"] | undefined;
    client.cache.modify({
      id: ref,
      fields: {
        status: (existing) => {
          previous = existing as PostDraft["status"];
          return status;
        },
      },
    });
    return previous;
  };

  const reportError = (fallback: string) => (err: unknown) => {
    toast({
      title: "Error",
      description: getGraphQLErrorMessage(err, fallback),
      variant: "destructive",
    });
  };

  const refreshLists = () =>
    client.refetchQueries({ include: ["PostDrafts", "MyPostDrafts"] });

  const act = async (
    draftId: string,
    optimisticStatus: PostDraft["status"] | null,
    run: () => Promise<unknown>,
    successTitle: string,
    failureFallback: string,
  ) => {
    if (pendingRef.current.has(draftId)) return;
    pendingRef.current.add(draftId);
    setPendingIds(new Set(pendingRef.current));

    let previousStatus: PostDraft["status"] | undefined;
    if (optimisticStatus) {
      previousStatus = applyStatus(draftId, optimisticStatus);
    }

    try {
      await run();
      toast({ title: successTitle });
      await refreshLists();
    } catch (err) {
      if (previousStatus !== undefined && optimisticStatus) {
        const ref = client.cache.identify({ __typename: "PostDraft", id: draftId });
        if (ref) {
          const snapshot = client.cache.readFragment<{ status: PostDraft["status"] }>({
            id: ref,
            fragment: POST_DRAFT_STATUS_FRAGMENT,
          });
          // Only rollback if the entity still exists and still shows the
          // optimistic status. If another tab/user won the race and
          // refetched to APPROVED/REJECTED, or the draft was evicted
          // (withdrawn), we must not overwrite winner's truth with a
          // stale rollback to PENDING.
          if (snapshot && snapshot.status === optimisticStatus) {
            applyStatus(draftId, previousStatus);
          }
        }
      }
      reportError(failureFallback)(err);
    } finally {
      pendingRef.current.delete(draftId);
      setPendingIds(new Set(pendingRef.current));
    }
  };

  const approve = async (draftId: string, edits: DraftEditsInput) =>
    act(
      draftId,
      "APPROVED",
      () => approveMutation({ variables: { id: draftId, input: edits } }),
      "Draft Approved",
      "Could not approve the draft.",
    );

  const reject = async (draftId: string, reason: string) =>
    act(
      draftId,
      "REJECTED",
      () =>
        rejectMutation({
          variables: { id: draftId, reason: reason || null },
        }),
      "Draft Rejected",
      "Could not reject the draft.",
    );

  const withdraw = async (draftId: string) =>
    act(
      draftId,
      null,
      () => withdrawMutation({ variables: { id: draftId } }),
      "Draft Withdrawn",
      "Could not withdraw the draft.",
    );

  const mapSection = (
    loading: boolean,
    error?: Error,
    data?: PaginatedDraftSection,
  ) => ({
    section: loading ? ("loading" as const) : error ? ("error" as const) : ("ready" as const),
    data: data ?? emptySection,
  });

  const community = {
    ...mapSection(
      communityQuery.loading,
      communityQuery.error,
      communityQuery.data?.postDrafts,
    ),
    page: communityPage,
    setPage: setCommunityPage,
    refetch: () => void communityQuery.refetch(),
  };
  const mine = {
    ...mapSection(mineQuery.loading, mineQuery.error, mineQuery.data?.myPostDrafts),
    page: minePage,
    setPage: setMinePage,
    refetch: () => void mineQuery.refetch(),
  };

  return {
    isAuthenticated,
    community,
    mine,
    dialog,
    setDialog,
    pendingIds,
    isPending,
    approve,
    reject,
    withdraw,
  };
};
