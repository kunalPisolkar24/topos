import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export const BlogCardSkeleton: React.FC = () => {
  return (
    <Card className="gap-0 bg-surface-lowest py-0">
      <div className="grid gap-0 md:h-[280px] md:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.95fr)]">
        <Skeleton className="aspect-[8/5] w-full rounded-none bg-surface-low md:col-start-2 md:row-start-1 md:h-full md:aspect-auto" />
        <div className="flex min-w-0 flex-col gap-4 px-4 py-5 sm:px-5 sm:py-6 lg:px-6 lg:py-6 md:col-start-1 md:row-start-1 md:justify-center">
          <div className="space-y-4">
            <div className="space-y-3.5">
              <Skeleton className="h-8 w-4/5 rounded-none bg-surface-low sm:h-9" />
              <Skeleton className="h-8 w-3/5 rounded-none bg-surface-low sm:h-9" />
              <Skeleton className="h-4 w-full rounded-none bg-surface-low" />
              <Skeleton className="h-4 w-11/12 rounded-none bg-surface-low" />
              <Skeleton className="h-4 w-3/4 rounded-none bg-surface-low" />
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-2.5">
              <Skeleton className="h-3 w-24 rounded-none bg-primary/30" />
              <Skeleton className="h-3 w-20 rounded-none bg-primary/30" />
              <Skeleton className="h-3 w-28 rounded-none bg-primary/30" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Skeleton className="size-2.5 rounded-none bg-primary/45" />
            <Skeleton className="h-3 w-28 rounded-none bg-surface-low" />
            <Skeleton className="h-3 w-px rounded-none bg-outline-variant/30" />
            <Skeleton className="h-3 w-24 rounded-none bg-surface-low" />
          </div>
        </div>
      </div>
    </Card>
  );
};
