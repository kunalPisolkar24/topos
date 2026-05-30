import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export const ViewBlogPageSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-surface">
      <Skeleton className="h-[var(--app-navbar-height)] w-full fixed top-0 left-0 z-50 bg-surface-low border-b border-outline-variant/20" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-10 pb-12 pt-app-navbar-offset">
        <Skeleton className="mb-8 h-[250px] sm:h-[300px] md:h-[400px] w-full bg-surface-low" />

        <div className="flex flex-col lg:flex-row gap-8">
          <main className="flex-1 space-y-6">
            <Skeleton className="h-10 w-3/4 bg-surface-low" />
            <Skeleton className="h-4 w-1/3 bg-surface-lowest" />
            <div className="space-y-3">
              <Skeleton className="h-5 w-full bg-surface-lowest" />
              <Skeleton className="h-5 w-full bg-surface-lowest" />
              <Skeleton className="h-5 w-5/6 bg-surface-lowest" />
              <Skeleton className="h-5 w-3/4 bg-surface-lowest" />
              <Skeleton className="h-5 w-full bg-surface-lowest" />
              <Skeleton className="h-5 w-2/3 bg-surface-lowest" />
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-2">
              <Skeleton className="h-5 w-20 bg-surface-low" />
              <Skeleton className="h-5 w-24 bg-surface-low" />
              <Skeleton className="h-5 w-16 bg-surface-low" />
            </div>
            <div className="mt-10 pt-6">
              <Skeleton className="h-10 w-full sm:w-40 bg-surface-lowest" />
            </div>
          </main>

          <aside className="w-full lg:w-80 shrink-0">
            <Card className="sticky top-24 bg-surface-lowest gap-4 p-6">
              <div className="flex flex-col items-center">
                <Skeleton className="w-24 h-24 rounded-full bg-surface-low ring-1 ring-outline-variant/20" />
                <Skeleton className="mt-4 h-6 w-3/4 bg-surface-low" />
                <Skeleton className="mt-2 h-4 w-1/2 bg-surface-lowest" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-1/3 bg-surface-low" />
                <Skeleton className="h-4 w-full bg-surface-lowest" />
                <Skeleton className="h-4 w-5/6 bg-surface-lowest" />
                <Skeleton className="h-4 w-3/4 bg-surface-lowest" />
              </div>
              <div className="flex flex-col gap-3 pt-2">
                <Skeleton className="h-10 w-full bg-surface-low" />
                <Skeleton className="h-10 w-full bg-surface-lowest" />
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
};
