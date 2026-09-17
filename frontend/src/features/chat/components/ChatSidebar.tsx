import { useEffect, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/shared/ui/primitives/button";
import { Input } from "@/shared/ui/primitives/input";
import { Skeleton } from "@/shared/ui/primitives/skeleton";
import { cn } from "@/shared/lib/cn";
import type { ChatThread } from "@/entities/chat";

interface ChatSidebarProps {
  chats: ChatThread[];
  activeChatId: string | null;
  isLoading: boolean;
  hasError: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onRetry: () => void;
}

const formatChatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  chats,
  activeChatId,
  isLoading,
  hasError,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onRetry,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    if (!confirmingId) return;
    const timer = window.setTimeout(() => setConfirmingId(null), 3000);
    return () => window.clearTimeout(timer);
  }, [confirmingId]);

  const startEditing = (chat: ChatThread) => {
    setEditingId(chat.id);
    setDraftTitle(chat.title);
    setConfirmingId(null);
  };

  const commitRename = (id: string) => {
    if (draftTitle.trim()) onRename(id, draftTitle);
    setEditingId(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-low ring-1 ring-outline-variant/20">
      <div className="flex items-center justify-between gap-2 p-3 sm:p-4">
        <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-primary">
          Chats
        </p>
        <Button type="button" variant="outline" size="xs" onClick={onCreate} aria-label="Start new chat">
          <Plus className="h-3 w-3" />
          New
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-3 sm:px-4 sm:pb-4">
        {isLoading && (
          <div className="space-y-1">
            {[0, 1, 2].map((skeleton) => (
              <Skeleton key={skeleton} className="h-12 rounded-none bg-surface-lowest" />
            ))}
          </div>
        )}
        {hasError && !isLoading && (
          <div className="bg-surface-lowest p-3 ring-1 ring-outline-variant/20">
            <p className="text-sm text-muted-foreground">Could not load chats.</p>
            <Button type="button" variant="outline" size="xs" className="mt-2" onClick={onRetry}>
              Try again
            </Button>
          </div>
        )}
        {!isLoading && !hasError && chats.length === 0 && (
          <p className="bg-surface-lowest p-3 text-sm leading-6 text-muted-foreground ring-1 ring-outline-variant/20">
            No chats yet. Start one to ask about Topos posts.
          </p>
        )}
        {chats.map((chat) => {
          const isActive = chat.id === activeChatId;
          const isEditing = editingId === chat.id;
          const isConfirming = confirmingId === chat.id;
          return (
            <div
              key={chat.id}
              className={cn(
                "group bg-surface-lowest px-3 py-2.5 ring-1 ring-outline-variant/20",
                isActive && "bg-primary-container ring-primary/40",
              )}
            >
              {isEditing ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    value={draftTitle}
                    maxLength={80}
                    aria-label="Chat title"
                    className="h-8 text-sm"
                    onChange={(event) => setDraftTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") commitRename(chat.id);
                      if (event.key === "Escape") setEditingId(null);
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Save chat title"
                    onClick={() => commitRename(chat.id)}
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Cancel rename"
                    onClick={() => setEditingId(null)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onSelect(chat.id)}
                    aria-label={`Open chat ${chat.title}`}
                    className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  >
                    <p className="truncate font-sans text-sm font-medium text-foreground">
                      {chat.title}
                    </p>
                    <p className="mt-0.5 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted-foreground">
                      {formatChatDate(chat.updatedAt)}
                    </p>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Rename chat ${chat.title}`}
                    className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100 focus-visible:opacity-100"
                    onClick={() => startEditing(chat)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  {isConfirming ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="xs"
                      aria-label={`Confirm delete chat ${chat.title}`}
                      onClick={() => {
                        setConfirmingId(null);
                        onDelete(chat.id);
                      }}
                    >
                      Sure?
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Delete chat ${chat.title}`}
                      className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100 focus-visible:opacity-100"
                      onClick={() => setConfirmingId(chat.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
