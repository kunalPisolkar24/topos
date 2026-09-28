import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";
import { chatRepository } from "@/entities/chat";
import type { ChatMessageItem, ChatThread } from "@/entities/chat";
import { useToast } from "@/shared/ui/hooks/useToast";
import { useSessionStore } from "@/entities/session";
import { chatQuerySchema } from "./model/chat.schema";

export interface ChatMessageView extends ChatMessageItem {
  stopped?: boolean;
  pending?: boolean;
}

export interface ChatStreamingOptions {
  intervalMs?: number;
  chunkSize?: number;
}

export interface UseChatControllerResult {
  isAuthenticated: boolean;
  chats: ChatThread[];
  chatsLoading: boolean;
  chatsError: boolean;
  refetchChats: () => void;
  activeChatId: string | null;
  activeChat: ChatThread | undefined;
  messages: ChatMessageView[];
  messagesLoading: boolean;
  messagesError: boolean;
  refetchMessages: () => void;
  streamingContent: string;
  isAsking: boolean;
  isCreating: boolean;
  askError: string | null;
  selectChat: (id: string | null) => void;
  createChat: (title?: string) => Promise<string | null>;
  renameChat: (id: string, title: string) => Promise<void>;
  deleteChat: (id: string) => Promise<void>;
  ask: (query: string) => Promise<void>;
  stop: () => void;
}

const DEFAULT_STREAM_INTERVAL_MS = 24;
const DEFAULT_STREAM_CHUNK_SIZE = 160;

// Mirrors services/content/internal/service/chat_service.go defaultChatTitle.
// Chats created without a title carry this until the first question names them.
const UNTITLED_CHAT_TITLE = "New Chat";

const toTempId = () => `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// useChatController drives the chat page: chat list selection, message
// history, and ask/stop lifecycles. Asking never uses optimistic writes:
// the mutation resolves, the answer reveals progressively as an ephemeral
// preview, then lists refetch and the preview clears. Server ids dedupe
// against the local echo so aborts converge without duplicates.
export const useChatController = (streaming?: ChatStreamingOptions): UseChatControllerResult => {
  const client = useApolloClient();
  const { toast } = useToast();
  const isAuthenticated =
    useSessionStore((state) => state.status) === "authenticated";

  const intervalMs = streaming?.intervalMs ?? DEFAULT_STREAM_INTERVAL_MS;
  const chunkSize = streaming?.chunkSize ?? DEFAULT_STREAM_CHUNK_SIZE;

  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [localEcho, setLocalEcho] = useState<ChatMessageView[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<number | null>(null);
  const sequenceRef = useRef(0);

  const chatsQuery = chatRepository.useChats(1, { skip: !isAuthenticated });
  const messagesQuery = chatRepository.useMessages(activeChatId ?? "", 1, {
    skip: !isAuthenticated || !activeChatId,
  });

  const [createChatMutation] = chatRepository.useCreateChat();
  const [renameChatMutation] = chatRepository.useRenameChat();
  const [deleteChatMutation] = chatRepository.useDeleteChat();
  const [askChatMutation] = chatRepository.useAskChat();

  const chats = useMemo(
    () => chatsQuery.data?.chats.chats ?? [],
    [chatsQuery.data],
  );
  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId),
    [chats, activeChatId],
  );

  const serverMessages = useMemo(() => {
    const items = messagesQuery.data?.chatMessages.messages ?? [];
    return [...items].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [messagesQuery.data]);

  const messages = useMemo(() => {
    const serverIds = new Set(serverMessages.map((message) => message.id));
    // An optimistic user echo is redundant once the server thread contains
    // the same user message (same chat + content): drop it so the question
    // never renders twice while the refetch converges.
    const serverUserContents = new Set(
      serverMessages
        .filter((message) => message.role === "USER")
        .map((message) => `${message.chatId}::${message.content}`),
    );
    return [
      ...serverMessages,
      ...localEcho.filter((message) => {
        if (serverIds.has(message.id)) return false;
        if (
          message.role === "USER" &&
          message.pending &&
          serverUserContents.has(`${message.chatId}::${message.content}`)
        ) {
          return false;
        }
        return true;
      }),
    ];
  }, [serverMessages, localEcho]);

  const clearReveal = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!activeChatId && chats.length > 0) {
      setActiveChatId(chats[0].id);
    }
  }, [activeChatId, chats]);

  useEffect(() => {
    setLocalEcho([]);
    setStreamingContent("");
    setAskError(null);
  }, [activeChatId]);

  useEffect(() => {
    const abort = abortRef.current;
    return () => {
      abort?.abort();
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, []);

  const selectChat = useCallback((id: string | null) => {
    abortRef.current?.abort();
    sequenceRef.current += 1;
    setIsAsking(false);
    setStreamingContent("");
    setActiveChatId(id);
  }, []);

  const createChat = useCallback(
    async (title?: string): Promise<string | null> => {
      setIsCreating(true);
      try {
        const { data } = await createChatMutation({ variables: { title: title ?? null } });
        const id = data?.createChat.id ?? null;
        if (id) {
          await chatRepository.refreshChatLists(client);
          setActiveChatId(id);
        }
        return id;
      } catch {
        toast({ title: "Could not create chat", variant: "destructive" });
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [client, createChatMutation, toast],
  );

  const renameChat = useCallback(
    async (id: string, title: string): Promise<void> => {
      const trimmed = title.trim();
      if (!trimmed) {
        toast({ title: "Title is required", variant: "destructive" });
        return;
      }
      try {
        await renameChatMutation({ variables: { id, title: trimmed } });
        chatRepository.writeChatTitle(client, id, trimmed);
        await chatRepository.refreshChatLists(client);
      } catch {
        toast({ title: "Could not rename chat", variant: "destructive" });
      }
    },
    [client, renameChatMutation, toast],
  );

  const deleteChat = useCallback(
    async (id: string): Promise<void> => {
      try {
        await deleteChatMutation({ variables: { id } });
        toast({ title: "Chat deleted" });
        chatRepository.evictChat(client, id);
        await chatRepository.refreshChatLists(client);
        setActiveChatId((current) => (current === id ? null : current));
      } catch {
        toast({ title: "Could not delete chat", variant: "destructive" });
      }
    },
    [client, deleteChatMutation, toast],
  );

  const stop = useCallback(() => {
    sequenceRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    clearReveal();
    setIsAsking(false);
    setStreamingContent("");
    setLocalEcho([]);
    void messagesQuery.refetch?.().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearReveal]);

  const ask = useCallback(
    async (query: string): Promise<void> => {
      const parsed = chatQuerySchema.safeParse({ query });
      if (!parsed.success) {
        setAskError(parsed.error.issues[0]?.message ?? "Message is required");
        return;
      }
      if (isAsking) return;
      setAskError(null);

      let chatId = activeChatId;
      if (!chatId) {
        chatId = await createChat(query.trim().slice(0, 40));
        if (!chatId) return;
      }

      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;
      const sequence = ++sequenceRef.current;
      const trimmed = parsed.data.query;

      setIsAsking(true);
      setStreamingContent("");

      // Optimistic echo: the question renders instantly instead of waiting
      // for the answer. It reconciles against the refetch (see messages)
      // and is removed if the ask fails or is stopped.
      const echoId = toTempId();
      const echo: ChatMessageView = {
        __typename: "ChatMessage",
        id: echoId,
        chatId,
        role: "USER",
        content: trimmed,
        citedPostIds: [],
        createdAt: new Date().toISOString(),
        pending: true,
      };
      setLocalEcho((prev) => [...prev, echo]);

      try {
        const { data } = await askChatMutation({
          variables: { chatId, query: trimmed },
          context: { fetchOptions: { signal: controller.signal } },
        });
        if (sequence !== sequenceRef.current || controller.signal.aborted) return;
        const assistant = data?.askChat;
        if (!assistant) {
          setIsAsking(false);
          return;
        }

        const full = assistant.content;
        let revealed = 0;
        await new Promise<void>((resolve) => {
          intervalRef.current = window.setInterval(() => {
            if (sequence !== sequenceRef.current) {
              if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
              resolve();
              return;
            }
            revealed += chunkSize;
            setStreamingContent(full.slice(0, revealed));
            if (revealed >= full.length) {
              if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
              intervalRef.current = null;
              resolve();
            }
          }, intervalMs);
        });
        if (sequence !== sequenceRef.current || controller.signal.aborted) return;

        const now = new Date().toISOString();
        setLocalEcho((prev) => [
          // The optimistic echo already shows the question: drop it and
          // keep only the confirmed pair so nothing renders twice.
          ...prev.filter((message) => message.id !== echoId),
          {
            __typename: "ChatMessage",
            id: toTempId(),
            chatId,
            role: "USER",
            content: trimmed,
            citedPostIds: [],
            createdAt: now,
          },
          { ...assistant },
        ]);
        setStreamingContent("");
        setIsAsking(false);
        abortRef.current = null;
        // Chats created from the sidebar start untitled ("New Chat" server
        // default): name them after the first question that was asked.
        if (chats.some((chat) => chat.id === chatId && chat.title === UNTITLED_CHAT_TITLE)) {
          const title = trimmed.slice(0, 40);
          try {
            await renameChatMutation({ variables: { id: chatId, title } });
            chatRepository.writeChatTitle(client, chatId, title);
          } catch {
            // Non-critical: the chat keeps its default title.
          }
        }
        await chatRepository.refreshChatLists(client);
        try {
          await messagesQuery.refetch?.();
          if (sequence === sequenceRef.current) setLocalEcho([]);
        } catch {
          // Keep the local echo as fallback until the next successful refetch.
        }
      } catch (err) {
        if (sequence !== sequenceRef.current) return;
        clearReveal();
        setIsAsking(false);
        setStreamingContent("");
        setLocalEcho((prev) => prev.filter((message) => message.id !== echoId));
        abortRef.current = null;
        if (controller.signal.aborted || (err instanceof Error && err.name === "AbortError")) {
          void messagesQuery.refetch?.().catch(() => {});
          return;
        }
        setAskError("Could not get an answer. Please try again.");
        toast({ title: "Could not get an answer", variant: "destructive" });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeChatId, askChatMutation, chats, chunkSize, clearReveal, client, createChat, intervalMs, isAsking, renameChatMutation, toast],
  );

  return {
    isAuthenticated,
    chats,
    chatsLoading: chatsQuery.loading,
    chatsError: Boolean(chatsQuery.error),
    refetchChats: () => void chatsQuery.refetch?.().catch(() => {}),
    activeChatId,
    activeChat,
    messages,
    messagesLoading: messagesQuery.loading,
    messagesError: Boolean(messagesQuery.error),
    refetchMessages: () => void messagesQuery.refetch?.().catch(() => {}),
    streamingContent,
    isAsking,
    isCreating,
    askError,
    selectChat,
    createChat,
    renameChat,
    deleteChat,
    ask,
    stop,
  };
};
