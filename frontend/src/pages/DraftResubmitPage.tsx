"use client";

import * as React from "react";
import { PencilLine } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { StickyNavbar, BlogEditor } from "@/widgets";
import { LoadingSpinner } from "@/shared/ui/feedback/LoadingSpinner";
import { Button } from "@/shared/ui/primitives/button";
import { useCurrentUser } from "@/entities/session";
import { BlogEditForm } from "@/features/blog/components/BlogEditForm";
import { RejectionNotePanel } from "@/features/blog/review/RejectionNotePanel";
import { useReviewQueueController } from "@/features/blog/review/useReviewQueueController";
import { useReviewerIdentity } from "@/features/blog/review/hooks/useReviewerIdentity";

// Full update-post-style editor for resubmitting a rejected draft: rich
// text body, changeable banner image, tags. Saving sends the draft back
// to peer review; nothing goes live until a peer approves it.
const DraftResubmitPage: React.FC = () => {
  const { draftId } = useParams<{ draftId: string }>();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const controller = useReviewQueueController();

  const draft = React.useMemo(() => {
    if (!draftId) return undefined;
    const all = [
      ...(controller.community.data?.drafts ?? []),
      ...(controller.mine.data?.drafts ?? []),
    ];
    return all.find((d) => d.id === draftId);
  }, [controller.community.data, controller.mine.data, draftId]);

  const isLoading =
    controller.community.section === "loading" ||
    controller.mine.section === "loading";

  const { user: reviewer } = useReviewerIdentity(draft?.reviewedById);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface text-foreground">
        <StickyNavbar />
        <main className="container mx-auto px-4 pb-20 pt-app-navbar-offset sm:px-5 lg:px-6">
          <LoadingSpinner />
        </main>
      </div>
    );
  }

  const isOwnRejected =
    Boolean(user?.id && draft && draft.authorId === user.id) &&
    draft?.status === "REJECTED";

  if (!draft || !isOwnRejected) {
    return (
      <div className="min-h-screen bg-surface text-foreground">
        <StickyNavbar />
        <main className="container mx-auto px-4 pb-20 pt-app-navbar-offset sm:px-5 lg:px-6">
          <div className="mx-auto max-w-3xl bg-surface-low p-6 ring-1 ring-outline-variant/20 sm:p-8">
            <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-primary">
              Cannot edit
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
              {!draft
                ? "Draft not found."
                : "Only your own rejected drafts can be edited."}
            </h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {!draft
                ? "It may have been withdrawn or already reviewed."
                : "Pending drafts can be withdrawn; approved drafts are final."}
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link to={draftId ? `/review/${draftId}` : "/review"}>
                Back to review
              </Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const reviewerLabel = reviewer
    ? reviewer.name || reviewer.username
    : draft.reviewedById
      ? draft.reviewedById.slice(0, 8)
      : undefined;

  return (
    <div className="min-h-screen bg-surface text-foreground">
      <StickyNavbar />
      <main className="container mx-auto px-4 pb-20 pt-app-navbar-offset sm:px-5 lg:px-6">
        <div className="mx-auto max-w-[88rem]">
          <header className="relative mb-6 overflow-hidden bg-surface-low p-5 ring-1 ring-outline-variant/20 sm:p-8 lg:p-10">
            <div
              className="absolute inset-0 opacity-30 [background-image:linear-gradient(to_right,rgb(var(--outline-variant)/0.16)_1px,transparent_1px),linear-gradient(to_bottom,rgb(var(--outline-variant)/0.12)_1px,transparent_1px)] [background-size:4rem_4rem]"
              aria-hidden="true"
            />
            <div className="absolute right-0 top-0 h-28 w-28 bg-primary-container" aria-hidden="true" />
            <div className="relative max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 bg-primary-container px-3 py-2 text-primary-foreground">
                <PencilLine className="h-4 w-4" aria-hidden="true" />
                <span className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.18em]">
                  Resubmit Console
                </span>
              </div>
              <h1 className="break-words text-3xl font-semibold leading-none tracking-[-0.05em] text-foreground sm:text-4xl md:text-5xl">
                Revise your rejected draft.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
                Fix the title, cover image, body, or tags. Saving sends it back to peer review — rejected stays rejected until you change something.
              </p>
            </div>
          </header>

          {draft.rejectionNote && (
            <div className="mb-6">
              <RejectionNotePanel
                note={draft.rejectionNote}
                reviewerLabel={reviewerLabel}
                reviewedAt={draft.reviewedAt ?? null}
              />
            </div>
          )}

          <BlogEditForm
            blog={{
              id: draft.id,
              title: draft.title,
              body: draft.body,
              imageUrl: draft.imageUrl ?? null,
              tags: draft.tags.map((tag) => ({ id: tag, name: tag })),
            }}
            mode="resubmit"
            resubmitDraftId={draft.id}
            resubmitPostId={draft.postId ?? null}
            initialSummary={draft.summary ?? null}
            onCancel={() => navigate(`/review/${draft.id}`)}
            onComplete={() => navigate(`/review/${draft.id}`)}
            renderEditor={({ value, onChange, onImageUpload, quillRef }) => (
              <BlogEditor
                ref={quillRef as React.MutableRefObject<never>}
                value={value}
                onChange={onChange}
                onImageUpload={onImageUpload}
              />
            )}
          />
        </div>
      </main>
    </div>
  );
};

export default DraftResubmitPage;
