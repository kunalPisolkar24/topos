import type React from "react";
import { ShieldAlert } from "lucide-react";

export const RejectionNotePanel: React.FC<{
  note: string;
  reviewerLabel?: string;
  reviewedAt?: string | null;
}> = ({ note, reviewerLabel, reviewedAt }) => {
  return (
    <div className="bg-surface-lowest p-4 ring-1 ring-outline-variant/20 sm:p-5">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-destructive" aria-hidden="true" />
        <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-destructive">
          Rejection note // Reviewer
        </p>
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-foreground/90">{note}</p>
      {(reviewerLabel || reviewedAt) && (
        <p className="mt-3 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted-foreground">
          {[reviewerLabel, reviewedAt ? new Date(reviewedAt).toLocaleDateString() : null].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
};
