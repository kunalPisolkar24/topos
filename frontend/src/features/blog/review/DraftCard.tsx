import type React from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/shared/ui/primitives/badge";
import { Button } from "@/shared/ui/primitives/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/ui/primitives/card";
import { Check, Eye, Pencil, RotateCcw, Undo2, ShieldAlert } from "lucide-react";
import type { DraftStatus, PostDraft } from "@/shared/graphql/content-documents";
import { isPreview } from "@/shared/config/preview";
import { usePreviewDraftReview } from "./hooks/usePreviewReview";
import { DraftSummary } from "./DraftSummary";

const statusBadge: Record<
  DraftStatus,
  { label: string; className: string }
> = {
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

interface DraftCardProps {
  draft: PostDraft;
  isOwnDraft: boolean;
  onApprove: (draft: PostDraft) => void;
  onReject: (draft: PostDraft) => void;
  onWithdraw: (draft: PostDraft) => void;
  onResubmit?: (draft: PostDraft) => void;
}

export const DraftCard: React.FC<DraftCardProps> = ({
  draft,
  isOwnDraft,
  onApprove,
  onReject,
  onWithdraw,
  onResubmit,
}) => {
  const statusStyle = statusBadge[draft.status] ?? statusBadge.PENDING;
  const { meta } = usePreviewDraftReview(isPreview() ? draft.id : null);
  const previewNote = isPreview() ? meta?.rejectionNote : null;
  const showNote = isPreview() && draft.status === "REJECTED" && Boolean(previewNote);

  return (
    <Card className="gap-0 rounded-none bg-surface-lowest py-0 ring-1 ring-outline-variant/20">
      <CardHeader className="p-4 pb-0 sm:p-5 sm:pb-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="line-clamp-2 text-lg font-semibold leading-tight tracking-[-0.03em] text-foreground">
              <Link
                to={`/review/${draft.id}`}
                className="transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                aria-label={`Open draft: ${draft.title}`}
              >
                {draft.title}
              </Link>
            </CardTitle>
            <p className="mt-2 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-muted-foreground">
              Prompted by author {draft.authorId.slice(0, 8)} ·{" "}
              {new Date(draft.createdAt).toLocaleDateString()}
            </p>
          </div>
          <Badge variant="default" className={statusStyle.className}>
            {statusStyle.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-3 sm:p-5 sm:pt-3">
        <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted-foreground">
          Summary
        </p>
        <div className="mt-2">
          <DraftSummary summary={draft.summary} variant="compact" />
        </div>
        {draft.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-primary">
            {draft.tags.map((tag) => (
              <span key={tag}>#{tag.toLowerCase()}</span>
            ))}
          </div>
        )}
        {showNote && (
          <div className="mt-3 bg-surface-low p-3 ring-1 ring-outline-variant/20">
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-destructive">Rejection note</p>
            </div>
            <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap break-words text-xs leading-6 text-foreground/80">{previewNote}</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 border-t border-outline-variant/20 bg-surface-low p-3 sm:px-5 sm:p-4">
        <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
          <Link to={`/review/${draft.id}`}>
            <Eye className="h-4 w-4" />
            View draft
          </Link>
        </Button>
        {!isOwnDraft && draft.status !== "APPROVED" && (
          <>
            <Button type="button" size="sm" className="w-full sm:w-auto" onClick={() => onApprove(draft)}>
              <Check className="h-4 w-4" />
              Review &amp; Approve
            </Button>
            {draft.status === "PENDING" && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => onReject(draft)}
              >
                <RotateCcw className="h-4 w-4" />
                Reject
              </Button>
            )}
          </>
        )}
        {isOwnDraft && draft.status === "REJECTED" && onResubmit && (
          <Button type="button" size="sm" className="w-full sm:w-auto" onClick={() => onResubmit(draft)}>
            <Pencil className="h-4 w-4" />
            Edit &amp; resubmit
          </Button>
        )}
        {isOwnDraft && (draft.status === "PENDING" || draft.status === "REJECTED") && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onWithdraw(draft)}
          >
            <Undo2 className="h-4 w-4" />
            Withdraw
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};
