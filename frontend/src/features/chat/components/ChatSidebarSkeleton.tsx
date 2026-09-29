// Minimal first-load state for the chat sidebar: plain text-line
// placeholders with no card chrome, shown only when no chats are cached.
// Background refetches keep the mounted list and signal with a slim bar.
export const ChatSidebarSkeleton: React.FC = () => {
  return (
    <div role="status" aria-label="Loading chats" className="px-1 py-1">
      <p className="font-mono text-[0.625rem] font-medium uppercase tracking-[0.22em] text-muted-foreground">
        Loading chats…
      </p>
      <span className="sr-only">Loading chats…</span>
    </div>
  );
};
