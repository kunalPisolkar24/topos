import { Skeleton } from "@/shared/ui/primitives/skeleton";

// Message-shaped loading state for the chat thread: mirrors the real
// bubbles (right-aligned user block, left-aligned assistant block with
// citation chips) so history loads without layout shift.
export const ChatThreadSkeleton: React.FC = () => {
  return (
    <div
      role="status"
      aria-label="Loading messages"
      className="h-full min-h-64 overflow-hidden bg-surface-lowest p-4 ring-1 ring-outline-variant/20 sm:p-5"
    >
      <div className="space-y-5" aria-hidden="true">
        <div>
          <Skeleton className="ml-auto h-2.5 w-24 bg-surface-low" />
          <div className="mt-1.5 flex justify-end">
            <Skeleton className="h-11 w-2/3 bg-primary-container/60 sm:w-1/2" />
          </div>
        </div>
        <div>
          <Skeleton className="h-2.5 w-24 bg-surface-low" />
          <div className="mt-1.5 flex justify-start">
            <div className="w-4/5 space-y-2.5 bg-surface-low p-4 ring-1 ring-outline-variant/20 sm:w-3/4">
              <Skeleton className="h-3.5 w-full bg-surface-lowest" />
              <Skeleton className="h-3.5 w-11/12 bg-surface-lowest" />
              <Skeleton className="h-3.5 w-3/4 bg-surface-lowest" />
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-6 w-24 bg-primary/30" />
                <Skeleton className="h-6 w-20 bg-primary/30" />
              </div>
            </div>
          </div>
        </div>
        <div>
          <Skeleton className="ml-auto h-2.5 w-24 bg-surface-low" />
          <div className="mt-1.5 flex justify-end">
            <Skeleton className="h-11 w-1/2 bg-primary-container/60 sm:w-2/5" />
          </div>
        </div>
      </div>
      <span className="sr-only">Loading messages…</span>
    </div>
  );
};
