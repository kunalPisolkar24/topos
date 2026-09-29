import type React from "react";
import { Link } from "react-router-dom";
import { Hourglass } from "lucide-react";
import { draftRepository } from "@/entities/draft/api/draftRepository";

interface PendingRevisionNoticeProps {
  postId: string;
  authorId: string;
  currentUserId?: string;
}

// Slim strip for the post author when one of their revisions is still
// pending. Everyone else keeps seeing the live post untouched.
export const PendingRevisionNotice: React.FC<PendingRevisionNoticeProps> = ({
  postId,
  authorId,
  currentUserId,
}) => {
  const isAuthor = Boolean(currentUserId && currentUserId === authorId);
  const { data } = draftRepository.useMyPostDrafts(1, { skip: !isAuthor });
  const pendingRevision = isAuthor
    ? data?.myPostDrafts.drafts.find((d) => d.postId === postId && d.status === "PENDING")
    : undefined;

  if (!pendingRevision) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-2 bg-primary-container px-4 py-3 text-primary-foreground">
      <p className="flex items-center gap-2 font-mono text-[0.625rem] font-medium uppercase tracking-[0.18em]">
        <Hourglass className="h-3.5 w-3.5" aria-hidden="true" />
        Revision pending peer review
      </p>
      <Link
        to={`/review/${pendingRevision.id}`}
        className="font-mono text-[0.625rem] font-medium uppercase tracking-[0.18em] underline underline-offset-4 hover:no-underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-foreground"
      >
        Open review
      </Link>
    </div>
  );
};
