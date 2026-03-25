import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export const BlogCardSkeleton: React.FC = () => {
  return (
    <Card className="gap-0 bg-surface-lowest py-0">
      <div className="grid gap-0 md:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.95fr)]">
        <div className="flex min-w-0 flex-col justify-between px-4 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
          <div className="space-y-4">
            <div className="space-y-3">
              <Skeleton className="h-8 w-4/5 rounded-none bg-surface-low sm:h-9" />
              <Skeleton className="h-8 w-3/5 rounded-none bg-surface-low sm:h-9" />
              <Skeleton className="h-4 w-full rounded-none bg-surface-low" />
              <Skeleton className="h-4 w-11/12 rounded-none bg-surface-low" />
              <Skeleton className="h-4 w-3/4 rounded-none bg-surface-low" />
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-2">
              <Skeleton className="h-3 w-24 rounded-none bg-primary-container/80" />
              <Skeleton className="h-3 w-20 rounded-none bg-primary-container/80" />
              <Skeleton className="h-3 w-28 rounded-none bg-primary-container/80" />
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Skeleton className="size-2.5 rounded-none bg-primary-container/80" />
            <Skeleton className="h-3 w-28 rounded-none bg-surface-low" />
            <Skeleton className="h-3 w-px rounded-none bg-outline-variant/30" />
            <Skeleton className="h-3 w-24 rounded-none bg-surface-low" />
          </div>
        </div>
        <Skeleton className="min-h-[220px] w-full rounded-none bg-surface-low md:min-h-full" />
      </div>
    </Card>
  );
};
