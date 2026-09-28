import { Skeleton } from "@/shared/ui/primitives/skeleton";

// Mirrors DraftCard: header with title + badge, summary block, tag row,
// and footer actions — so the review queue loads without layout shift.
export const DraftCardSkeleton: React.FC = () => {
  return (
    <div
      role="status"
      aria-label="Loading draft"
      className="bg-surface-lowest ring-1 ring-outline-variant/20"
    >
      <div className="p-4 sm:p-5" aria-hidden="true">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-6 w-4/5 bg-surface-low" />
            <Skeleton className="mt-2 h-2.5 w-40 bg-surface-low" />
          </div>
          <Skeleton className="h-6 w-24 bg-primary/30" />
        </div>
        <div className="mt-4 space-y-2">
          <Skeleton className="h-3.5 w-full bg-surface-low" />
          <Skeleton className="h-3.5 w-11/12 bg-surface-low" />
          <Skeleton className="h-3.5 w-3/5 bg-surface-low" />
        </div>
        <div className="mt-3 flex gap-3">
          <Skeleton className="h-3 w-16 bg-primary/30" />
          <Skeleton className="h-3 w-20 bg-primary/30" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2 bg-surface-low p-3 sm:px-5 sm:p-4" aria-hidden="true">
        <Skeleton className="h-9 w-full bg-surface-lowest sm:w-32" />
        <Skeleton className="h-9 w-full bg-surface-lowest sm:w-40" />
      </div>
      <span className="sr-only">Loading draft…</span>
    </div>
  );
};
