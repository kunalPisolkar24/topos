import { Skeleton } from "@/shared/ui/primitives/skeleton";

// Minimal app-shell loading state for route guards and lazy-route
// fallbacks: navbar bar plus a content block. Sharp corners and tonal
// tokens only, per the blueprint system — no spinners.
export const RouteShellSkeleton: React.FC = () => {
  return (
    <div role="status" aria-label="Loading page" className="min-h-screen bg-surface text-foreground">
      <Skeleton className="fixed left-0 top-0 z-50 h-[var(--app-navbar-height)] w-full bg-surface-low" />
      <main className="container mx-auto px-4 pb-20 pt-app-navbar-offset sm:px-5 lg:px-6">
        <div className="mx-auto max-w-[88rem] space-y-6" aria-hidden="true">
          <div className="bg-surface-low p-5 ring-1 ring-outline-variant/20 sm:p-6">
            <Skeleton className="h-3 w-40 bg-primary/35" />
            <Skeleton className="mt-4 h-9 w-2/3 bg-surface-lowest" />
            <Skeleton className="mt-2 h-4 w-1/2 bg-surface-lowest" />
          </div>
          <Skeleton className="h-48 w-full bg-surface-low" />
        </div>
      </main>
      <span className="sr-only">Loading page…</span>
    </div>
  );
};
