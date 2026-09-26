import type React from "react";
import { ShieldCheck } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useCurrentUser } from "@/entities/session";
import { PagePagination } from "@/shared/ui/PagePagination";
import { LoadingSpinner } from "@/shared/ui/feedback/LoadingSpinner";
import { Button } from "@/shared/ui/primitives/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/primitives/tabs";
import { useState } from "react";
import type { PostDraft } from "@/shared/graphql/content-documents";
import type { ContentDraftInput } from "@/shared/graphql/content-documents";
import { DraftCard } from "./DraftCard";
import { ApproveDraftDialog, buildEditsInput } from "./ApproveDraftDialog";
import { ApproveConfirmDialog } from "./ApproveConfirmDialog";
import { RejectNoteDialog } from "./RejectNoteDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  useReviewQueueController,
  type ReviewQueueController,
} from "./useReviewQueueController";
import type { ApproveDraftFormValues } from "./model/approve-draft.schema";
import { usePreviewReviewedDrafts } from "./hooks/usePreviewReview";
import { isPreview } from "@/shared/config/preview";

const REVIEW_TABS = ["needs-review", "your-drafts", "approved", "rejected"] as const;

type ReviewTab = (typeof REVIEW_TABS)[number];

const isReviewTab = (value: string | null): value is ReviewTab =>
  REVIEW_TABS.some((tab) => tab === value);

interface DraftSectionProps {
  kicker: string;
  title: string;
  description: string;
  section: ReviewQueueController["community"];
  currentUserId?: string;
  onApprove: (draft: PostDraft) => void;
  onReject: (draft: PostDraft) => void;
  onWithdraw: (draft: PostDraft) => void;
  onResubmit: (draft: PostDraft) => void;
}

const DraftSection: React.FC<DraftSectionProps> = ({
  kicker,
  title,
  description,
  section,
  currentUserId,
  onApprove,
  onReject,
  onWithdraw,
  onResubmit,
}) => {
  return (
    <section className="space-y-4">
      <div>
        <p className="font-mono text-[0.625rem] font-medium uppercase tracking-[0.22em] text-primary">
          {kicker}
        </p>
        <h2 className="mt-2 font-sans text-2xl font-semibold leading-none tracking-[-0.04em] text-foreground">
          {title}
        </h2>
        <p className="mt-2 max-w-2xl font-sans text-sm leading-7 text-muted-foreground">{description}</p>
      </div>

    {section.section === "loading" && <LoadingSpinner />}
    {section.section === "error" && (
      <div className="bg-surface-low p-6 ring-1 ring-outline-variant/20">
        <p className="text-sm text-muted-foreground">
          Could not load drafts.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={section.refetch}
        >
          Try again
        </Button>
      </div>
    )}
    {section.section === "ready" && section.data.drafts.length === 0 && (
      <div className="bg-surface-low p-6 ring-1 ring-outline-variant/20">
        <p className="text-sm text-muted-foreground">Nothing here right now.</p>
      </div>
    )}
    {section.section === "ready" && section.data.drafts.length > 0 && (
      <>
        <div className="grid gap-4">
          {section.data.drafts.map((draft) => (
            <DraftCard
              key={draft.id}
              draft={draft}
              isOwnDraft={Boolean(currentUserId && draft.authorId === currentUserId)}
              onApprove={onApprove}
              onReject={onReject}
              onWithdraw={onWithdraw}
              onResubmit={onResubmit}
            />
          ))}
        </div>
        {section.data.totalPages > 1 && (
          <PagePagination
            currentPage={section.data.currentPage}
            totalPages={section.data.totalPages}
            onPageChange={section.setPage}
            align="center"
          />
        )}
      </>
    )}
  </section>
  );
};

const ReviewQueuePage: React.FC = () => {
  const controller = useReviewQueueController();
  const { user } = useCurrentUser();

  const [searchParams, setSearchParams] = useSearchParams();
  const [approvedPage, setApprovedPage] = useState(1);
  const [rejectedPage, setRejectedPage] = useState(1);
  const approvedHistory = usePreviewReviewedDrafts(user?.id, "APPROVED", approvedPage, 6);
  const rejectedHistory = usePreviewReviewedDrafts(user?.id, "REJECTED", rejectedPage, 6);
  const previewOn = isPreview();

  const requestedTab = searchParams.get("tab");
  const tab: ReviewTab =
    isReviewTab(requestedTab) && (previewOn || requestedTab === "needs-review" || requestedTab === "your-drafts")
      ? requestedTab
      : "needs-review";

  const handleTabChange = (value: string) => {
    if (!isReviewTab(value)) return;
    setSearchParams(value === "needs-review" ? {} : { tab: value }, { replace: true });
    // Revalidate the newly visible list — data may have changed while away.
    if (value === "needs-review") controller.community.refetch();
    else if (value === "your-drafts") controller.mine.refetch();
    else if (value === "approved") void approvedHistory.refresh();
    else void rejectedHistory.refresh();
  };

  const toHistorySection = (
    loading: boolean,
    data: typeof approvedHistory.data,
    page: number,
    setPage: (page: number) => void,
    refresh: () => void,
  ): ReviewQueueController["community"] => ({
    section: loading ? "loading" : "ready",
    data: {
      drafts: (data?.drafts ?? []) as unknown as PostDraft[],
      totalPages: data?.totalPages ?? 0,
      currentPage: data?.currentPage ?? page,
      totalDrafts: data?.totalDrafts ?? 0,
    },
    page,
    setPage,
    refetch: () => {
      void refresh();
    },
  });

  const approvedSection = toHistorySection(
    approvedHistory.loading,
    approvedHistory.data,
    approvedPage,
    setApprovedPage,
    approvedHistory.refresh,
  );
  const rejectedSection = toHistorySection(
    rejectedHistory.loading,
    rejectedHistory.data,
    rejectedPage,
    setRejectedPage,
    rejectedHistory.refresh,
  );

  const communityCount =
    controller.community.section === "ready" ? controller.community.data.totalDrafts : null;
  const mineCount =
    controller.mine.section === "ready" ? controller.mine.data.totalDrafts : null;
  const approvedCount = !approvedHistory.loading ? (approvedHistory.data?.totalDrafts ?? 0) : null;
  const rejectedCount = !rejectedHistory.loading ? (rejectedHistory.data?.totalDrafts ?? 0) : null;

  if (!controller.isAuthenticated) {
    return (
      <main className="container mx-auto px-4 pb-20 pt-app-navbar-offset sm:px-5 lg:px-6">
        <div className="mx-auto max-w-[88rem]">
          <div className="mx-auto max-w-2xl bg-surface-low p-10 text-center ring-1 ring-outline-variant/20">
            <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
            <h1 className="mt-4 text-xl font-semibold">Sign in to review drafts</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The review queue is only available to signed-in users.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const handleApproveConfirm = (draft: PostDraft) => {
    controller.setDialog({ kind: "closed" });
    void controller.approve(draft.id, {});
  };

  const handleResubmitConfirm = (draft: PostDraft, values: ApproveDraftFormValues) => {
    const edits = buildEditsInput(draft.id, values).input;
    const input: ContentDraftInput = {
      title: edits.title ?? draft.title,
      body: edits.body ?? draft.body,
      summary: edits.summary ?? null,
      tags: edits.tags ?? [],
      postId: draft.postId ?? null,
    };
    controller.setDialog({ kind: "closed" });
    void controller.resubmit(draft.id, input);
  };

  return (
    <>
      <main className="container mx-auto px-4 pb-20 pt-app-navbar-offset sm:px-5 lg:px-6">
        <div className="mx-auto max-w-[88rem]">
          <header className="relative overflow-hidden bg-surface-low p-5 ring-1 ring-outline-variant/20 sm:p-8">
            <div className="mb-5 inline-flex items-center gap-2 bg-primary-container px-3 py-2 text-primary-foreground">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.18em]">
                Peer Review
              </span>
            </div>
            <h1 className="break-words text-2xl font-semibold tracking-[-0.05em] text-foreground sm:text-3xl md:text-5xl">
              Every post earns its place.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
              New posts and revisions stay pending until someone else approves them.
              You can never review your own work — that is the point.
            </p>
          </header>

          <Tabs value={tab} onValueChange={handleTabChange} className="mt-8">
            <TabsList className="h-auto max-w-full flex-wrap justify-start" aria-label="Review queue sections">
              <TabsTrigger value="needs-review">
                Needs review
                {communityCount !== null && (
                  <span className="text-muted-foreground" aria-hidden="true"> ({communityCount})</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="your-drafts">
                Your drafts
                {mineCount !== null && (
                  <span className="text-muted-foreground" aria-hidden="true"> ({mineCount})</span>
                )}
              </TabsTrigger>
              {previewOn && (
                <TabsTrigger value="approved">
                  Approved by you
                  {approvedCount !== null && (
                    <span className="text-muted-foreground" aria-hidden="true"> ({approvedCount})</span>
                  )}
                </TabsTrigger>
              )}
              {previewOn && (
                <TabsTrigger value="rejected">
                  Rejected by you
                  {rejectedCount !== null && (
                    <span className="text-muted-foreground" aria-hidden="true"> ({rejectedCount})</span>
                  )}
                </TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="needs-review" className="mt-6">
              <DraftSection
                kicker="Review queue // Community"
                title="Needs review"
                description="Pending posts and revisions from other authors. Approve to publish or reject with a note."
                section={controller.community}
                currentUserId={user?.id}
                onApprove={(draft) => controller.setDialog({ kind: "approve", draft })}
                onReject={(draft) => controller.setDialog({ kind: "reject", draft })}
                onWithdraw={() => {}}
                onResubmit={() => {}}
              />
            </TabsContent>
            <TabsContent value="your-drafts" className="mt-6">
              <DraftSection
                kicker="Review queue // Yours"
                title="Your drafts"
                description="Everything you submitted, in every state. Pending or rejected drafts can be withdrawn; rejected ones carry the reviewer note and go back to review once you edit them."
                section={controller.mine}
                currentUserId={user?.id}
                onApprove={() => {}}
                onReject={() => {}}
                onWithdraw={(draft) => controller.setDialog({ kind: "withdraw", draft })}
                onResubmit={(draft) => controller.setDialog({ kind: "resubmit", draft })}
              />
            </TabsContent>
            {previewOn && (
              <TabsContent value="approved" className="mt-6">
                <DraftSection
                  kicker="Review history // Approved by me"
                  title="Approved by you"
                  description="Drafts you approved (published under the author's name)."
                  section={approvedSection}
                  currentUserId={user?.id}
                  onApprove={() => {}}
                  onReject={() => {}}
                  onWithdraw={() => {}}
                  onResubmit={() => {}}
                />
              </TabsContent>
            )}
            {previewOn && (
              <TabsContent value="rejected" className="mt-6">
                <DraftSection
                  kicker="Review history // Rejected by me"
                  title="Rejected by you"
                  description="Drafts you rejected with a note. The author sees your note."
                  section={rejectedSection}
                  currentUserId={user?.id}
                  onApprove={() => {}}
                  onReject={() => {}}
                  onWithdraw={() => {}}
                  onResubmit={() => {}}
                />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </main>

      <ApproveConfirmDialog
        draft={controller.dialog.kind === "approve" ? controller.dialog.draft : null}
        onOpenChange={(open) => {
          if (!open) controller.setDialog({ kind: "closed" });
        }}
        onConfirm={handleApproveConfirm}
      />

      <RejectNoteDialog
        draft={controller.dialog.kind === "reject" ? controller.dialog.draft : null}
        onOpenChange={(open) => {
          if (!open) controller.setDialog({ kind: "closed" });
        }}
        onConfirm={(draft, note) => {
          controller.setDialog({ kind: "closed" });
          void controller.reject(draft.id, note);
        }}
      />

      <ApproveDraftDialog
        draft={
          controller.dialog.kind === "resubmit" ? controller.dialog.draft : null
        }
        isSubmitting={false}
        dialogTitle="Edit & resubmit draft"
        dialogDescription="Rejected stays rejected until you change something. Saving sends it back to peer review."
        confirmLabel="Resubmit for review"
        confirmingLabel="Resubmitting..."
        onOpenChange={(open) => {
          if (!open) controller.setDialog({ kind: "closed" });
        }}
        onConfirm={handleResubmitConfirm}
      />

      <ConfirmDialog
        open={controller.dialog.kind === "withdraw"}
        title="Withdraw this draft?"
        description="Your pending or rejected draft will be removed from every review queue. This cannot be undone."
        confirmLabel="Withdraw draft"
        destructive
        onOpenChange={(open) => {
          if (!open) controller.setDialog({ kind: "closed" });
        }}
        onConfirm={() => {
          const draft =
            controller.dialog.kind === "withdraw" ? controller.dialog.draft : null;
          controller.setDialog({ kind: "closed" });
          if (draft) void controller.withdraw(draft.id);
        }}
      />
    </>
  );
};

export default ReviewQueuePage;
