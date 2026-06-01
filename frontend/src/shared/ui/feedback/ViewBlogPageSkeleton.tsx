import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export const ViewBlogPageSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-surface text-foreground">
      <Skeleton className="fixed left-0 top-0 z-50 h-[var(--app-navbar-height)] w-full rounded-none bg-surface-low" />

      <main className="container mx-auto px-4 pb-20 pt-app-navbar-offset sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="bg-surface-low ring-1 ring-outline-variant/20">
            <Skeleton className="h-[18rem] w-full rounded-none bg-surface-lowest sm:h-[24rem] lg:h-[30rem]" />
            <div className="p-4 sm:p-6 lg:p-8">
              <div className="bg-surface-lowest p-5 ring-1 ring-outline-variant/20 sm:p-7 lg:p-8">
                <Skeleton className="h-3 w-36 rounded-none bg-primary/35" />
                <Skeleton className="mt-5 h-14 w-11/12 rounded-none bg-surface-low md:h-20" />
                <Skeleton className="mt-3 h-14 w-3/5 rounded-none bg-surface-low md:h-20" />
                <div className="mt-6 flex gap-2">
                  <Skeleton className="h-8 w-36 rounded-none bg-surface-low" />
                  <Skeleton className="h-8 w-32 rounded-none bg-primary/30" />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_384px]">
            <section className="space-y-6">
              <div className="bg-surface-lowest p-4 ring-1 ring-outline-variant/20 sm:p-6 lg:p-8">
                <Skeleton className="h-3 w-20 rounded-none bg-primary/35" />
                <div className="mt-8 space-y-3">
                  <Skeleton className="h-5 w-full rounded-none bg-surface-low" />
                  <Skeleton className="h-5 w-full rounded-none bg-surface-low" />
                  <Skeleton className="h-5 w-5/6 rounded-none bg-surface-low" />
                  <Skeleton className="h-5 w-3/4 rounded-none bg-surface-low" />
                  <Skeleton className="h-5 w-full rounded-none bg-surface-low" />
                  <Skeleton className="h-5 w-2/3 rounded-none bg-surface-low" />
                </div>
                <div className="mt-8 flex flex-wrap gap-2">
                  <Skeleton className="h-8 w-20 rounded-none bg-primary/30" />
                  <Skeleton className="h-8 w-24 rounded-none bg-primary/30" />
                  <Skeleton className="h-8 w-16 rounded-none bg-primary/30" />
                </div>
              </div>
              <Skeleton className="h-24 w-full rounded-none bg-surface-low" />
            </section>

            <aside className="w-full shrink-0 lg:w-80 xl:w-96">
              <Card className="sticky top-app-navbar-offset gap-0 bg-surface-low py-0">
                <div className="p-4 sm:p-5">
                  <Skeleton className="h-3 w-28 rounded-none bg-primary/35" />
                  <div className="mt-4 flex items-start gap-3">
                    <Skeleton className="h-10 w-10 rounded-full bg-surface-lowest" />
                    <div className="min-w-0 flex-1">
                      <Skeleton className="h-6 w-3/4 rounded-none bg-surface-lowest" />
                      <Skeleton className="mt-2 h-3 w-1/2 rounded-none bg-surface-lowest" />
                    </div>
                  </div>
                </div>
                <div className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
                  <Skeleton className="h-16 w-full rounded-none bg-surface-lowest" />
                  <Skeleton className="h-40 w-full rounded-none bg-surface-lowest" />
                  <Skeleton className="h-10 w-full rounded-none bg-surface-lowest" />
                </div>
              </Card>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
};
