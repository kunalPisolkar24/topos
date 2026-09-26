import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { RichTextView } from "@/shared/ui/feedback";
import { Check, Eye, Pencil, RotateCcw, Undo2, ArrowLeft, FileText, Sparkles } from "lucide-react";
import { Badge } from "@/shared/ui/primitives/badge";
import { Button } from "@/shared/ui/primitives/button";
import { Card, CardContent } from "@/shared/ui/primitives/card";
import { LoadingSpinner } from "@/shared/ui/feedback/LoadingSpinner";
import { useCurrentUser } from "@/entities/session";
import type { PostDraft } from "@/shared/graphql/content-documents";
import type { ContentDraftInput } from "@/shared/graphql/content-documents";
import { getDisplayName } from "@/shared/lib/account-identity";
import { ApproveDraftDialog, buildEditsInput } from "./ApproveDraftDialog";
import { ApproveConfirmDialog } from "./ApproveConfirmDialog";
import { RejectNoteDialog } from "./RejectNoteDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { RejectionNotePanel } from "./RejectionNotePanel";
import { ApprovedByCard } from "./ApprovedByCard";
import { DraftSummary } from "./DraftSummary";
import { useReviewQueueController } from "./useReviewQueueController";
import type { ApproveDraftFormValues } from "./model/approve-draft.schema";
import { useReviewerIdentity } from "./hooks/useReviewerIdentity";

const statusBadge: Record<PostDraft["status"], { label: string; className: string }> = {
  PENDING: {
    label: "Pending review",
    className:
      "rounded-none border border-outline-variant/20 bg-primary-container px-2 py-0.5 font-mono text-[0.625rem] font-medium uppercase tracking-[0.18em] text-primary-foreground",
  },
  APPROVED: {
    label: "Approved",
    className:
      "rounded-none border border-primary/30 bg-primary px-2 py-0.5 font-mono text-[0.625rem] font-medium uppercase tracking-[0.18em] text-primary-foreground",
  },
  REJECTED: {
    label: "Rejected",
    className:
      "rounded-none border border-destructive/20 bg-destructive px-2 py-0.5 font-mono text-[0.625rem] font-medium uppercase tracking-[0.18em] text-destructive-foreground",
  },
};

export const DraftDetail: React.FC = () => {
  const { draftId } = useParams<{ draftId: string }>();
  const navigate = useNavigate();
  const controller = useReviewQueueController();
  const { user } = useCurrentUser();

  const draft: PostDraft | undefined = React.useMemo(() => {
    if (!draftId) return undefined;
    const all = [
      ...(controller.community.data?.drafts ?? []),
      ...(controller.mine.data?.drafts ?? []),
    ];
    return all.find((d) => d.id === draftId);
  }, [controller.community.data, controller.mine.data, draftId]);

  const isLoading = controller.community.section === "loading" || controller.mine.section === "loading";
  const isError = controller.community.section === "error" || controller.mine.section === "error";

  const { user: reviewer } = useReviewerIdentity(draft?.reviewedById);

  const handleApproveConfirm = (target: PostDraft) => {
    controller.setDialog({ kind: "closed" });
    void controller.approve(target.id, {}).then(() => navigate("/review"));
  };

  const handleResubmitConfirm = (target: PostDraft, values: ApproveDraftFormValues) => {
    const edits = buildEditsInput(target.id, values).input;
    const input: ContentDraftInput = {
      title: edits.title ?? target.title,
      body: edits.body ?? target.body,
      summary: edits.summary ?? null,
      tags: edits.tags ?? [],
      imageUrl: target.imageUrl ?? null,
      postId: target.postId ?? null,
    };
    controller.setDialog({ kind: "closed" });
    void controller.resubmit(target.id, input);
  };

  if (!draftId) {
    return (
      <div className="mx-auto max-w-3xl bg-surface-low p-6 ring-1 ring-outline-variant/20 sm:p-8">
        <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-primary">Missing draft</p>
        <p className="mt-2 text-sm text-muted-foreground">No draft identifier in the URL.</p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/review">
            <ArrowLeft className="h-4 w-4" />
            Back to queue
          </Link>
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl bg-surface-low p-6 ring-1 ring-outline-variant/20 sm:p-8">
        <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-primary">Unable to load</p>
        <p className="mt-2 text-sm text-muted-foreground">Could not load drafts. Try again from the queue.</p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/review">
            <ArrowLeft className="h-4 w-4" />
            Back to queue
          </Link>
        </Button>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="mx-auto max-w-3xl bg-surface-low p-6 ring-1 ring-outline-variant/20 sm:p-8">
        <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-primary">Draft not found</p>
        <h1 className="mt-3 font-sans text-2xl font-semibold tracking-[-0.03em] text-foreground">No draft matches this queue page.</h1>
        <p className="mt-2 max-w-xl font-sans text-sm leading-7 text-muted-foreground">
          It may be on another page, already reviewed, or withdrawn. Return to the queue to see the current pending drafts.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/review">
            <ArrowLeft className="h-4 w-4" />
            Back to queue
          </Link>
        </Button>
      </div>
    );
  }

  const isOwnDraft = Boolean(user?.id && draft.authorId === user.id);
  const badge = statusBadge[draft.status] ?? statusBadge.PENDING;

  const canReview = !isOwnDraft && draft.status !== "APPROVED";
  const canReject = canReview && draft.status === "PENDING";
  const canWithdraw = isOwnDraft && (draft.status === "PENDING" || draft.status === "REJECTED");
  const canResubmit = isOwnDraft && draft.status === "REJECTED";
  const isApproved = draft.status === "APPROVED";
  const authorLabel = getDisplayName(draft.author, draft.authorId.slice(0, 8));
  const reviewerLabel = reviewer
    ? reviewer.name || reviewer.username
    : draft.reviewedById
      ? draft.reviewedById.slice(0, 8)
      : undefined;

  return (
    <>
      <div className="mx-auto max-w-[88rem]">
        <Button asChild variant="ghost" size="sm" className="mb-6">
          <Link to="/review">
            <ArrowLeft className="h-4 w-4" />
            Back to queue
          </Link>
        </Button>

        <header className="relative overflow-hidden bg-surface-low p-5 ring-1 ring-outline-variant/20 sm:p-8">
          <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(to_right,rgb(var(--outline-variant)/0.16)_1px,transparent_1px),linear-gradient(to_bottom,rgb(var(--outline-variant)/0.12)_1px,transparent_1px)] [background-size:4rem_4rem]" aria-hidden="true" />
          <div className="absolute right-0 top-0 h-28 w-28 bg-primary-container" aria-hidden="true" />
          <div className="relative">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="inline-flex items-center gap-2 bg-primary-container px-3 py-2 text-primary-foreground">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.18em]">Peer Review // Draft</span>
              </div>
              <Badge variant="default" className={badge.className}>{badge.label}</Badge>
            </div>
            <h1 className="mt-6 max-w-3xl break-words text-balance font-sans text-2xl font-semibold leading-[1.05] tracking-[-0.025em] text-foreground sm:text-3xl md:text-4xl lg:text-5xl">{draft.title}</h1>
            <p className="mt-3 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-muted-foreground">
              Prompted by {authorLabel} · {new Date(draft.createdAt).toLocaleDateString()} · {draft.status.toLowerCase()}
            </p>
            {draft.postId && (
              <Button asChild size="sm" variant="outline" className="mt-4">
                <Link to={`/blog/${draft.postId}`}>
                  <Eye className="h-4 w-4" />
                  {isApproved ? "View published post" : "View live post"}
                </Link>
              </Button>
            )}
          </div>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_384px]">
          <div className="min-w-0 space-y-6">
            {draft.imageUrl && (
              <figure className="overflow-hidden bg-surface-low ring-1 ring-outline-variant/20">
                <img
                  src={draft.imageUrl}
                  alt={`Cover for ${draft.title}`}
                  className="block aspect-[8/5] w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <figcaption className="px-4 py-2 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted-foreground sm:px-5">
                  Cover asset
                </figcaption>
              </figure>
            )}
            <Card className="gap-0 rounded-none bg-surface-lowest py-0 ring-1 ring-outline-variant/20">
              <CardContent className="p-0">
                <div className="flex items-center gap-3 bg-surface-low px-4 py-3 ring-1 ring-outline-variant/20 sm:px-5">
                  <span className="h-2 w-2 bg-primary" aria-hidden="true" />
                  <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-primary">Body</p>
                </div>
                <div className="p-3 sm:p-5 lg:p-6">
                  <RichTextView html={draft.body} />
                </div>
              </CardContent>
            </Card>

            <section className="grid gap-6 md:grid-cols-2">
              <Card className="gap-0 rounded-none bg-surface-lowest py-0 ring-1 ring-outline-variant/20">
                <CardContent className="p-4 sm:p-5">
                  <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted-foreground">Summary</p>
                  <div className="mt-2">
                    <DraftSummary summary={draft.summary} variant="full" />
                  </div>
                </CardContent>
              </Card>
              <Card className="gap-0 rounded-none bg-surface-lowest py-0 ring-1 ring-outline-variant/20">
                <CardContent className="p-4 sm:p-5">
                  <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted-foreground">Prompt</p>
                  <p className="mt-2 font-mono text-xs leading-6 text-muted-foreground">{draft.prompt}</p>
                </CardContent>
              </Card>
            </section>

            {draft.tags.length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-2 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-primary">
                {draft.tags.map((tag) => (
                  <span key={tag}>#{tag.toLowerCase()}</span>
                ))}
              </div>
            )}
            {draft.status === "REJECTED" && draft.rejectionNote && (
              <RejectionNotePanel note={draft.rejectionNote} reviewerLabel={reviewerLabel} reviewedAt={draft.reviewedAt ?? null} />
            )}
            {isApproved && draft.reviewedById && (
              <ApprovedByCard approvedById={draft.reviewedById} reviewedAt={draft.reviewedAt ?? null} reviewerName={reviewer?.name ?? null} reviewerAvatarUrl={reviewer?.avatarUrl ?? null} draftId={draft.id} compact />
            )}
          </div>

          <aside className="w-full shrink-0 lg:sticky lg:top-app-navbar-offset lg:w-80 lg:self-start xl:w-96">
            <Card className="gap-0 rounded-none bg-surface-low py-0 ring-1 ring-outline-variant/20">
              <CardContent className="p-4 sm:p-5">
                <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-primary">Review actions</p>
                <p className="mt-2 font-sans text-sm leading-6 text-muted-foreground">
                  {isOwnDraft
                    ? "This is your draft — you cannot review your own work. Withdraw while pending or edit a rejected draft to resubmit."
                    : "Approve to publish as-is, or reject with a required note. The author sees rejection notes. Approved drafts publish under the author's name."}
                </p>

                <div className="mt-5 grid gap-2">
                  {canReview && (
                    <Button type="button" size="sm" className="w-full" onClick={() => controller.setDialog({ kind: "approve", draft })} disabled={controller.isPending(draft.id)}>
                      <Check className="h-4 w-4" />
                      Review &amp; Approve
                    </Button>
                  )}
                  {canReject && (
                    <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => controller.setDialog({ kind: "reject", draft })} disabled={controller.isPending(draft.id)}>
                      <RotateCcw className="h-4 w-4" />
                      Reject
                    </Button>
                  )}
                  {canResubmit && (
                    <Button type="button" size="sm" className="w-full" onClick={() => controller.setDialog({ kind: "resubmit", draft })} disabled={controller.isPending(draft.id)}>
                      <Pencil className="h-4 w-4" />
                      Edit &amp; resubmit
                    </Button>
                  )}
                  {canWithdraw && (
                    <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => controller.setDialog({ kind: "withdraw", draft })} disabled={controller.isPending(draft.id)}>
                      <Undo2 className="h-4 w-4" />
                      Withdraw draft
                    </Button>
                  )}
                  {isApproved && (
                    <div className="rounded-none border border-outline-variant/20 bg-surface-lowest px-3 py-2 text-center font-mono text-[0.625rem] uppercase tracking-[0.16em] text-muted-foreground">
                      Approved — {draft.postId ? "published" : "finalizing"}
                    </div>
                  )}
                  {!canReview && !canWithdraw && !canResubmit && !isApproved && (
                    <div className="rounded-none border border-outline-variant/20 bg-surface-lowest px-3 py-2 text-center font-mono text-[0.625rem] uppercase tracking-[0.16em] text-muted-foreground">
                      No actions available
                    </div>
                  )}
                </div>

                <div className="mt-6 space-y-2 border-t border-outline-variant/20 pt-4">
                  <div className="flex items-center gap-2 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-muted-foreground">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    <span>Draft meta</span>
                  </div>
                  <dl className="space-y-2 font-mono text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Status</dt>
                      <dd className="font-medium uppercase tracking-[0.08em] text-foreground">{draft.status}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Author</dt>
                      <dd className="truncate font-medium text-foreground" title={draft.authorId}>{authorLabel}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Created</dt>
                      <dd className="text-foreground">{new Date(draft.createdAt).toLocaleDateString()}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Updated</dt>
                      <dd className="text-foreground">{new Date(draft.updatedAt).toLocaleDateString()}</dd>
                    </div>
                  </dl>
                </div>

                <Button asChild variant="ghost" size="sm" className="mt-4 w-full">
                  <Link to="/review">
                    <ArrowLeft className="h-4 w-4" />
                    Back to queue
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      <ApproveConfirmDialog
        draft={controller.dialog.kind === "approve" ? controller.dialog.draft : null}
        onOpenChange={(open) => {
          if (!open) controller.setDialog({ kind: "closed" });
        }}
        onConfirm={handleApproveConfirm}
      />

      <ApproveDraftDialog
        draft={controller.dialog.kind === "resubmit" ? controller.dialog.draft : null}
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

      <RejectNoteDialog
        draft={controller.dialog.kind === "reject" ? controller.dialog.draft : null}
        onOpenChange={(open) => {
          if (!open) controller.setDialog({ kind: "closed" });
        }}
        onConfirm={(d, note) => {
          controller.setDialog({ kind: "closed" });
          void controller.reject(d.id, note).then(() => navigate("/review"));
        }}
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
          const d = controller.dialog.kind === "withdraw" ? controller.dialog.draft : null;
          controller.setDialog({ kind: "closed" });
          if (d) void controller.withdraw(d.id).then(() => navigate("/review"));
        }}
      />
    </>
  );
};
