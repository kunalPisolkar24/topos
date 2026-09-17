import { useState } from "react";
import { Send, Square } from "lucide-react";
import { Button } from "@/shared/ui/primitives/button";
import { Label } from "@/shared/ui/primitives/label";
import { Textarea } from "@/shared/ui/primitives/textarea";
import { MAX_CHAT_QUERY_CHARS } from "../model/chat.schema";

interface ChatComposerProps {
  isAsking: boolean;
  askError: string | null;
  onAsk: (query: string) => void;
  onStop: () => void;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  isAsking,
  askError,
  onAsk,
  onStop,
}) => {
  const [value, setValue] = useState("");

  const trimmed = value.trim();
  const canSend = !isAsking && trimmed.length > 0 && value.length <= MAX_CHAT_QUERY_CHARS;

  const handleSend = () => {
    if (!canSend) return;
    onAsk(value);
    setValue("");
  };

  return (
    <form
      className="border border-outline-variant/20 bg-surface-low p-3 sm:p-4"
      onSubmit={(event) => {
        event.preventDefault();
        handleSend();
      }}
    >
      <Label htmlFor="chat-composer-input" className="font-mono text-[0.625rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Ask about Topos posts
      </Label>
      <Textarea
        id="chat-composer-input"
        value={value}
        rows={2}
        maxLength={MAX_CHAT_QUERY_CHARS + 100}
        placeholder="How do I make retries safe for mutating APIs?"
        disabled={isAsking}
        aria-label="Chat message"
        className="mt-2 min-h-16 resize-none"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            handleSend();
          }
        }}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="min-w-0 flex-1 truncate font-mono text-[0.625rem] tracking-[0.08em] text-muted-foreground" aria-live="polite" title={askError ?? undefined}>
          {askError ?? `${value.length}/${MAX_CHAT_QUERY_CHARS}`}
        </p>
        {isAsking ? (
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={onStop} aria-label="Stop generating">
            <Square className="h-3.5 w-3.5" />
            Stop
          </Button>
        ) : (
          <Button type="submit" size="sm" className="shrink-0" disabled={!canSend} aria-label="Send message">
            <Send className="h-3.5 w-3.5" />
            Send
          </Button>
        )}
      </div>
    </form>
  );
};
