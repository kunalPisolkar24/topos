import type React from "react";
import { CheckCircle2, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/primitives/avatar";

interface ApprovedByCardProps {
  approvedById?: string | null;
  reviewedAt?: string | null;
  reviewerName?: string | null;
  reviewerAvatarUrl?: string | null;
  draftId?: string | null;
  compact?: boolean;
}

export const ApprovedByCard: React.FC<ApprovedByCardProps> = ({
  approvedById,
  reviewedAt,
  reviewerName,
  reviewerAvatarUrl,
  draftId,
  compact = false,
}) => {
  const fallback = reviewerName ? reviewerName.charAt(0).toUpperCase() : approvedById ? approvedById.slice(0, 1).toUpperCase() : "?";
  const label = reviewerName || (approvedById ? `${approvedById.slice(0, 8)}` : "Approved");

  return (
    <div className={`bg-surface-low ring-1 ring-outline-variant/20 ${compact ? "p-3" : "p-4 sm:p-5"}`}>
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
        <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-primary">
          Approved // Peer review
        </p>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Avatar size="sm" className="shrink-0">
          <AvatarImage src={reviewerAvatarUrl || undefined} alt={label} />
          <AvatarFallback className="bg-primary-container font-mono text-xs uppercase text-primary-foreground">{fallback}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-mono text-[0.75rem] font-medium uppercase tracking-[0.08em] text-foreground">{label}</p>
          {reviewedAt && <p className="font-mono text-[0.625rem] tracking-[0.08em] text-muted-foreground">{new Date(reviewedAt).toLocaleDateString()}</p>}
        </div>
      </div>
      {!compact && draftId && (
        <Link to={`/review/${draftId}`} className="mt-3 inline-flex items-center gap-1 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-primary hover:text-primary/80">
          <FileText className="h-3.5 w-3.5" />
          View reviewed draft
        </Link>
      )}
    </div>
  );
};
