import { Skeleton } from "@/shared/ui/primitives/skeleton";

// Mirrors the draft detail layout: back link, blueprint header, body
// blocks, and side actions — used by the draft detail and resubmit pages.
export const DraftDetailSkeleton: React.FC = () => {
  return (
    <div role="status" aria-label="Loading draft" className="mx-auto max-w-[88rem]">
      <Skeleton className="h-9 w-32 bg-surface-low" />
      <div className="mt-6 bg-surface-low p-5 ring-1 ring-outline-variant/20 sm:p-8" aria-hidden="true">
        <Skeleton className="h-3 w-40 bg-primary/35" />
        <Skeleton className="mt-4 h-9 w-3/4 bg-surface-lowest" />
        <Skeleton className="mt-2 h-9 w-1/2 bg-surface-lowest" />
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-8 w-28 bg-surface-lowest" />
          <Skeleton className="h-8 w-24 bg-primary/30" />
        </div>
      </div>
      <div className="mt-6 space-y-3 bg-surface-lowest p-4 ring-1 ring-outline-variant/20 sm:p-6" aria-hidden="true">
        <Skeleton className="h-4 w-full bg-surface-low" />
        <Skeleton className="h-4 w-full bg-surface-low" />
        <Skeleton className="h-4 w-5/6 bg-surface-low" />
        <Skeleton className="h-4 w-3/4 bg-surface-low" />
        <Skeleton className="h-4 w-full bg-surface-low" />
        <Skeleton className="h-4 w-2/3 bg-surface-low" />
      </div>
      <span className="sr-only">Loading draft…</span>
    </div>
  );
};
