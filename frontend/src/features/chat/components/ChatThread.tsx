import { useEffect, useRef, useState } from "react";
import { ArrowDown, Bot, Sparkles } from "lucide-react";
import { Button } from "@/shared/ui/primitives/button";
import { LoadingSpinner } from "@/shared/ui/feedback/LoadingSpinner";
import { cn } from "@/shared/lib/cn";
import type { ChatMessageView } from "../useChatController";
import { ChatCitations } from "./ChatCitations";

interface ChatThreadProps {
  messages: ChatMessageView[];
  isLoading: boolean;
  hasError: boolean;
  isAsking: boolean;
  streamingContent: string;
  onRetry: () => void;
  onSuggest: (query: string) => void;
}

const SCROLL_STICKY_PX = 200;

const SUGGESTED_QUERIES = [
  "How do I make retries safe for mutating APIs?",
  "What covers idempotency on Topos?",
  "Explain hybrid search on Topos.",
];

const formatMessageTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const ChatThread: React.FC<ChatThreadProps> = ({
  messages,
  isLoading,
  hasError,
  isAsking,
  streamingContent,
  onRetry,
  onSuggest,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showJump, setShowJump] = useState(false);

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distance < SCROLL_STICKY_PX) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, streamingContent, isAsking]);

  if (isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center bg-surface-lowest ring-1 ring-outline-variant/20">
        <LoadingSpinner />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="bg-surface-lowest p-6 ring-1 ring-outline-variant/20">
        <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-primary">
          Could not load messages
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  const showTyping = isAsking && streamingContent.length === 0;

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
        className="h-full min-h-64 overflow-y-auto bg-surface-lowest p-4 ring-1 ring-outline-variant/20 sm:p-5"
        onScroll={(event) => {
          const el = event.currentTarget;
          setShowJump(el.scrollHeight - el.scrollTop - el.clientHeight > SCROLL_STICKY_PX);
        }}
      >
        {messages.length === 0 && !isAsking ? (
          <div className="flex h-full min-h-64 flex-col items-center justify-center px-4 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center bg-primary-container text-primary-foreground">
              <Bot className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="mt-4 font-mono text-[0.625rem] font-medium uppercase tracking-[0.22em] text-primary">
              RAG Chat // Posts
            </p>
            <p className="mt-2 max-w-md font-sans text-base font-semibold tracking-[-0.02em] text-foreground">
              Start with a question
            </p>
            <p className="mt-1 max-w-md font-sans text-sm leading-7 text-muted-foreground">
              Answers are grounded in Topos posts and link their sources.
              Try one of these:
            </p>
            <div className="mt-4 flex max-w-lg flex-wrap justify-center gap-2">
              {SUGGESTED_QUERIES.map((suggestion) => (
                <Button
                  key={suggestion}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onSuggest(suggestion)}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {messages.map((message) => {
              const isUser = message.role === "USER";
              const timestamp = formatMessageTime(message.createdAt);
              return (
                <div key={message.id}>
                  <p
                    className={cn(
                      "font-mono text-[0.625rem] font-medium uppercase tracking-[0.18em] text-muted-foreground",
                      isUser ? "text-right" : "text-left",
                    )}
                  >
                    {isUser ? "You" : "Topos AI"}
                    {timestamp ? ` · ${timestamp}` : ""}
                  </p>
                  <div className={cn("mt-1.5 flex", isUser ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[85%] px-4 py-2.5 sm:max-w-[75%]",
                        isUser
                          ? "bg-primary-container text-primary-foreground"
                          : "bg-surface-low text-foreground ring-1 ring-outline-variant/20",
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words font-sans text-sm leading-7">
                        {message.content}
                      </p>
                      {!isUser && (
                        <ChatCitations citedPostIds={message.citedPostIds} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {showTyping && (
              <div className="flex justify-start">
                <div
                  className="flex items-center gap-1.5 bg-surface-low px-4 py-3 ring-1 ring-outline-variant/20"
                  aria-label="Assistant is typing"
                >
                  {[0, 1, 2].map((dot) => (
                    <span key={dot} className="size-1.5 animate-pulse rounded-full bg-primary" />
                  ))}
                </div>
              </div>
            )}
            {streamingContent.length > 0 && (
              <div className="flex justify-start">
                <div className="max-w-[85%] bg-surface-low px-4 py-2.5 ring-1 ring-outline-variant/20 sm:max-w-[75%]">
                  <p className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-foreground">
                    {streamingContent}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {showJump && (
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Jump to latest message"
          className="absolute bottom-4 right-4 bg-surface-lowest"
          onClick={scrollToBottom}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
