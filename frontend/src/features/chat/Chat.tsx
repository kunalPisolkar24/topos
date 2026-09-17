import { useState } from "react";
import { Bot, PanelLeft } from "lucide-react";
import { Button } from "@/shared/ui/primitives/button";
import { cn } from "@/shared/lib/cn";
import { useChatController } from "./useChatController";
import { ChatSidebar } from "./components/ChatSidebar";
import { ChatThread } from "./components/ChatThread";
import { ChatComposer } from "./components/ChatComposer";

export const Chat: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const controller = useChatController();

  return (
    <div className="mx-auto max-w-[88rem]">
      <header className="relative overflow-hidden bg-surface-low p-5 ring-1 ring-outline-variant/20 sm:p-6">
        <div
          className="absolute inset-0 opacity-30 [background-image:linear-gradient(to_right,rgb(var(--outline-variant)/0.16)_1px,transparent_1px),linear-gradient(to_bottom,rgb(var(--outline-variant)/0.12)_1px,transparent_1px)] [background-size:4rem_4rem]"
          aria-hidden="true"
        />
        <div className="absolute right-0 top-0 h-28 w-28 bg-primary-container" aria-hidden="true" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-primary-container px-3 py-2 text-primary-foreground">
              <Bot className="h-4 w-4" aria-hidden="true" />
              <span className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.18em]">
                RAG Chat // Grounded answers
              </span>
            </div>
            <h1 className="mt-4 text-balance font-sans text-2xl font-semibold leading-[1.05] tracking-[-0.025em] text-foreground sm:text-3xl">
              Ask Topos posts anything.
            </h1>
            <p className="mt-2 max-w-2xl font-sans text-sm leading-7 text-muted-foreground">
              Answers cite the exact posts they came from — open any citation
              to read the source.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 bg-surface-lowest lg:hidden"
            aria-expanded={sidebarOpen}
            aria-label={sidebarOpen ? "Hide chat list" : "Show chat list"}
            onClick={() => setSidebarOpen((open) => !open)}
          >
            <PanelLeft className="h-4 w-4" />
            Chats
          </Button>
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside
          className={cn(
            !sidebarOpen && "hidden lg:block",
            "lg:sticky lg:top-app-navbar-offset lg:h-[calc(100dvh-var(--app-navbar-offset)-6rem)] lg:self-start",
          )}
        >
          <div className="max-h-[50dvh] lg:h-full lg:max-h-none">
            <ChatSidebar
              chats={controller.chats}
              activeChatId={controller.activeChatId}
              isLoading={controller.chatsLoading}
              hasError={controller.chatsError}
              onSelect={(id) => {
                controller.selectChat(id);
                setSidebarOpen(false);
              }}
              onCreate={() => void controller.createChat()}
              onRename={(id, title) => void controller.renameChat(id, title)}
              onDelete={(id) => void controller.deleteChat(id)}
              onRetry={controller.refetchChats}
            />
          </div>
        </aside>

        <section className="flex h-[calc(100dvh-var(--app-navbar-offset)-2rem)] min-h-0 min-w-0 flex-col gap-3 sm:h-[calc(100dvh-var(--app-navbar-offset)-3rem)] lg:h-[calc(100dvh-var(--app-navbar-offset)-6rem)]">
          <div className="flex min-h-0 flex-1 flex-col">
            <ChatThread
              messages={controller.messages}
              isLoading={controller.messagesLoading && controller.messages.length === 0}
              hasError={controller.messagesError}
              isAsking={controller.isAsking}
              streamingContent={controller.streamingContent}
              onRetry={controller.refetchMessages}
              onSuggest={(query) => void controller.ask(query)}
            />
          </div>
          <div className="shrink-0">
            <ChatComposer
              isAsking={controller.isAsking}
              askError={controller.askError}
              onAsk={(query) => void controller.ask(query)}
              onStop={controller.stop}
            />
          </div>
        </section>
      </div>
    </div>
  );
};
