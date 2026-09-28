import { Skeleton } from "@/shared/ui/primitives/skeleton";

// List-shaped loading state for the chat sidebar: one skeleton row per
// expected chat entry, matching the real item padding and height.
export const ChatSidebarSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div role="status" aria-label="Loading chats" className="space-y-1">
      <div className="space-y-1" aria-hidden="true">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="bg-surface-lowest px-3 py-2.5 ring-1 ring-outline-variant/20">
            <Skeleton className="h-4 w-3/4 bg-surface-low" />
            <Skeleton className="mt-2 h-2.5 w-16 bg-surface-low" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading chats…</span>
    </div>
  );
};
