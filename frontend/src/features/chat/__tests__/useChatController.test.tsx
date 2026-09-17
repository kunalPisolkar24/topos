import { HttpResponse, graphql } from "msw";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApolloProvider } from "@apollo/client/react";
import { MemoryRouter } from "react-router-dom";
import type { ApolloClient } from "@apollo/client";
import { server } from "@/test/server";
import { createApolloClient } from "@/shared/api";
import { env } from "@/shared/config/env";
import { sessionStoreActions } from "@/entities/session";
import { useChatController } from "../useChatController";

const noopUnauthorized = async () => {};

const chatOne = {
  __typename: "Chat",
  id: "chat-1",
  title: "First chat",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-02T00:00:00.000Z",
};

const chatTwo = {
  __typename: "Chat",
  id: "chat-2",
  title: "Second chat",
  createdAt: "2025-01-03T00:00:00.000Z",
  updatedAt: "2025-01-03T00:00:00.000Z",
};

const historyPair = [
  {
    __typename: "ChatMessage",
    id: "msg-1",
    chatId: "chat-1",
    role: "USER",
    content: "Hello?",
    citedPostIds: [],
    createdAt: "2025-01-02T00:00:00.000Z",
  },
  {
    __typename: "ChatMessage",
    id: "msg-2",
    chatId: "chat-1",
    role: "ASSISTANT",
    content: "Hi there, grounded in Topos posts.",
    citedPostIds: ["post-1"],
    createdAt: "2025-01-02T00:01:00.000Z",
  },
];

const assistantReply = {
  __typename: "ChatMessage",
  id: "msg-3",
  chatId: "chat-1",
  role: "ASSISTANT",
  content: "Here is what the platform covers about idempotency.",
  citedPostIds: ["post-15"],
  createdAt: "2025-01-02T00:02:00.000Z",
};

const createWrapper = () => {
  let client!: ApolloClient;
  const wrapper = ({ children }: { children: ReactNode }) => {
    if (!client) {
      client = createApolloClient({
        uri: env.VITE_GRAPHQL_URL,
        getToken: () => null,
        onUnauthorized: noopUnauthorized,
      });
    }
    return (
      <ApolloProvider client={client}>
        <MemoryRouter initialEntries={["/chat"]}>{children}</MemoryRouter>
      </ApolloProvider>
    );
  };
  return { wrapper, getClient: () => client };
};

const setupChatHandlers = (overrides?: { askDelayMs?: number; failAsk?: boolean }) => {
  const graphqlApi = graphql.link("http://localhost:4000/graphql");
  const seen: { ask: unknown[]; create: unknown[] } = { ask: [], create: [] };
  // Stateful thread: AskChat persists the pair like the backend, so refetch
  // converges and the local echo must reconcile without duplicates.
  const threadExtras: typeof historyPair = [];
  server.use(
    graphqlApi.query("Chats", () =>
      HttpResponse.json({
        data: {
          chats: {
            __typename: "PaginatedChats",
            chats: [chatOne, chatTwo],
            totalPages: 1,
            currentPage: 1,
            totalChats: 2,
          },
        },
      }),
    ),
    graphqlApi.query("ChatMessages", () => {
      const thread = [...historyPair, ...threadExtras];
      return HttpResponse.json({
        data: {
          chatMessages: {
            __typename: "PaginatedMessages",
            messages: [...thread].reverse(),
            totalPages: 1,
            currentPage: 1,
            totalMessages: thread.length,
          },
        },
      });
    }),
    graphqlApi.mutation("AskChat", async ({ variables }) => {
      seen.ask.push(variables);
      if (overrides?.askDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, overrides.askDelayMs));
      }
      if (overrides?.failAsk) {
        return HttpResponse.json({ errors: [{ message: "ask failed" }] });
      }
      const query = (variables as { chatId: string; query: string }).query;
      const base = Date.parse("2025-01-02T00:02:00.000Z") + threadExtras.length * 60000;
      const userMessage = {
        __typename: "ChatMessage",
        id: `msg-u-${threadExtras.length + 1}`,
        chatId: "chat-1",
        role: "USER",
        content: query,
        citedPostIds: [],
        createdAt: new Date(base).toISOString(),
      };
      const assistantMessage = {
        ...assistantReply,
        id: `msg-a-${threadExtras.length + 2}`,
        createdAt: new Date(base + 1000).toISOString(),
      };
      threadExtras.push(userMessage, assistantMessage);
      return HttpResponse.json({ data: { askChat: assistantMessage } });
    }),
    graphqlApi.mutation("CreateChat", async ({ variables }) => {
      seen.create.push(variables);
      return HttpResponse.json({
        data: {
          createChat: {
            __typename: "Chat",
            id: "chat-3",
            title: "Fresh chat",
            createdAt: "2025-01-04T00:00:00.000Z",
            updatedAt: "2025-01-04T00:00:00.000Z",
          },
        },
      });
    }),
  );
  return seen;
};

describe("useChatController", () => {
  beforeEach(() => {
    sessionStoreActions.markAuthenticated("test-token");
  });

  it("loads chats, selects the first, and loads its messages", async () => {
    const { wrapper } = createWrapper();
    setupChatHandlers();

    const { result } = renderHook(() => useChatController(), { wrapper });

    await waitFor(() => {
      expect(result.current.chats).toHaveLength(2);
    });
    await waitFor(() => {
      expect(result.current.activeChatId).toBe("chat-1");
    });
    await waitFor(() => {
      expect(result.current.messages.map((message) => message.id)).toEqual([
        "msg-1",
        "msg-2",
      ]);
    });
  });

  it("asks a question and appends the user echo plus cited answer", async () => {
    const { wrapper } = createWrapper();
    const seen = setupChatHandlers();

    const { result } = renderHook(
      () => useChatController({ intervalMs: 1, chunkSize: 100000 }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.activeChatId).toBe("chat-1");
    });

    await act(async () => {
      await result.current.ask("How do retries work?");
    });

    expect(seen.ask[0]).toEqual({ chatId: "chat-1", query: "How do retries work?" });
    await waitFor(() => {
      const contents = result.current.messages.map((message) => message.content);
      // The echo reconciles with the refetch: exactly one user instance,
      // ordered before its answer.
      expect(contents.filter((content) => content === "How do retries work?")).toHaveLength(1);
      expect(contents).toContain(assistantReply.content);
      expect(contents.indexOf("How do retries work?")).toBeLessThan(
        contents.indexOf(assistantReply.content),
      );
    });
    const answer = result.current.messages.find((message) => message.role === "ASSISTANT" && message.content === assistantReply.content);
    expect(answer?.citedPostIds).toEqual(["post-15"]);
    expect(result.current.isAsking).toBe(false);
  });

  it("rejects blank questions without calling the API", async () => {
    const { wrapper } = createWrapper();
    const seen = setupChatHandlers();

    const { result } = renderHook(() => useChatController(), { wrapper });

    await waitFor(() => {
      expect(result.current.activeChatId).toBe("chat-1");
    });

    await act(async () => {
      await result.current.ask("   ");
    });

    expect(result.current.askError).toBe("Message is required");
    expect(seen.ask).toHaveLength(0);
    expect(result.current.isAsking).toBe(false);
  });

  it("stops a pending ask without appending an answer", async () => {
    const { wrapper } = createWrapper();
    setupChatHandlers({ askDelayMs: 300 });

    const { result } = renderHook(
      () => useChatController({ intervalMs: 1, chunkSize: 100000 }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.activeChatId).toBe("chat-1");
    });

    let askPromise: Promise<void> | undefined;
    act(() => {
      askPromise = result.current.ask("Will this be stopped?");
    });

    await waitFor(() => {
      expect(result.current.isAsking).toBe(true);
    });

    act(() => {
      result.current.stop();
    });
    await act(async () => {
      await askPromise;
    });

    expect(result.current.isAsking).toBe(false);
    expect(
      result.current.messages.some((message) => message.content === "Will this be stopped?"),
    ).toBe(false);
  });

  it("renames a chat and updates the cached title", async () => {
    const { wrapper } = createWrapper();
    setupChatHandlers();
    const graphqlApi = graphql.link("http://localhost:4000/graphql");
    const titles: Record<string, string> = {};
    server.use(
      graphqlApi.query("Chats", () => {
        const chats = [chatOne, chatTwo].map((c) => ({ ...c, title: titles[c.id] ?? c.title }));
        return HttpResponse.json({
          data: {
            chats: {
              __typename: "PaginatedChats",
              chats,
              totalPages: 1,
              currentPage: 1,
              totalChats: chats.length,
            },
          },
        });
      }),
      graphqlApi.mutation("RenameChat", async ({ variables }) => {
        const v = variables as { id: string; title: string };
        titles[v.id] = v.title;
        return HttpResponse.json({
          data: {
            renameChat: { ...chatOne, id: v.id, title: v.title },
          },
        });
      }),
    );

    const { result } = renderHook(() => useChatController(), { wrapper });

    await waitFor(() => {
      expect(result.current.chats).toHaveLength(2);
    });

    await act(async () => {
      await result.current.renameChat("chat-1", "Renamed chat");
    });

    await waitFor(() => {
      expect(result.current.chats.find((c) => c.id === "chat-1")?.title).toBe("Renamed chat");
    });
  });

  it("deletes a chat and drops its cached messages", async () => {
    const { wrapper, getClient } = createWrapper();
    const graphqlApi = graphql.link("http://localhost:4000/graphql");
    const deleted = new Set<string>();
    server.use(
      graphqlApi.query("Chats", () => {
        const chats = [chatOne, chatTwo].filter((c) => !deleted.has(c.id));
        return HttpResponse.json({
          data: {
            chats: {
              __typename: "PaginatedChats",
              chats,
              totalPages: 1,
              currentPage: 1,
              totalChats: chats.length,
            },
          },
        });
      }),
      graphqlApi.query("ChatMessages", ({ variables }) => {
        const chatId = (variables as { chatId: string }).chatId;
        const thread = deleted.has(chatId) ? [] : historyPair;
        return HttpResponse.json({
          data: {
            chatMessages: {
              __typename: "PaginatedMessages",
              messages: [...thread].reverse(),
              totalPages: 1,
              currentPage: 1,
              totalMessages: thread.length,
            },
          },
        });
      }),
      graphqlApi.mutation("DeleteChat", async ({ variables }) => {
        deleted.add((variables as { id: string }).id);
        return HttpResponse.json({ data: { deleteChat: true } });
      }),
    );

    const { result } = renderHook(() => useChatController(), { wrapper });

    await waitFor(() => {
      expect(result.current.activeChatId).toBe("chat-1");
    });
    await waitFor(() => {
      expect(result.current.messages.map((message) => message.id)).toEqual([
        "msg-1",
        "msg-2",
      ]);
    });

    await act(async () => {
      await result.current.deleteChat("chat-1");
    });

    await waitFor(() => {
      expect(result.current.chats.find((c) => c.id === "chat-1")).toBeUndefined();
    });
    expect(result.current.activeChatId).not.toBe("chat-1");
    const snapshot = getClient().cache.extract(false) as Record<string, unknown>;
    expect(snapshot["Chat:chat-1"]).toBeUndefined();
    expect(
      Object.keys(snapshot).filter((key) => key.includes('"chatId":"chat-1"')),
    ).toHaveLength(0);
  });

  it("surfaces ask failures without appending messages", async () => {
    const { wrapper } = createWrapper();
    setupChatHandlers({ failAsk: true });

    const { result } = renderHook(() => useChatController(), { wrapper });

    await waitFor(() => {
      expect(result.current.activeChatId).toBe("chat-1");
    });
    const before = result.current.messages.length;

    await act(async () => {
      await result.current.ask("Break please");
    });

    expect(result.current.askError).toBe("Could not get an answer. Please try again.");
    expect(result.current.messages).toHaveLength(before);
  });
});
