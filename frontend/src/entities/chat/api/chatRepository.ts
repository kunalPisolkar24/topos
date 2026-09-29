import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import {
  AskChatDocument,
  ChatDocument,
  ChatMessagesDocument,
  ChatsDocument,
  CreateChatDocument,
  DeleteChatDocument,
  RenameChatDocument,
  type AskChatMutation,
  type AskChatMutationVariables,
  type ChatMessagesQuery,
  type ChatMessagesQueryVariables,
  type ChatQuery,
  type ChatQueryVariables,
  type ChatsQuery,
  type ChatsQueryVariables,
  type CreateChatMutation,
  type CreateChatMutationVariables,
  type DeleteChatMutation,
  type DeleteChatMutationVariables,
  type RenameChatMutation,
  type RenameChatMutationVariables,
} from "./chat-documents";

const CHAT_LIST_LIMIT = 10;
const CHAT_MESSAGE_LIMIT = 20;

export interface ChatRepository {
  useChats(page: number, opts?: { skip?: boolean }): ReturnType<typeof useQuery<ChatsQuery, ChatsQueryVariables>>;
  useChat(id: string, opts?: { skip?: boolean }): ReturnType<typeof useQuery<ChatQuery, ChatQueryVariables>>;
  useMessages(chatId: string, page: number, opts?: { skip?: boolean }): ReturnType<typeof useQuery<ChatMessagesQuery, ChatMessagesQueryVariables>>;
  useCreateChat(): ReturnType<typeof useMutation<CreateChatMutation, CreateChatMutationVariables>>;
  useRenameChat(): ReturnType<typeof useMutation<RenameChatMutation, RenameChatMutationVariables>>;
  useDeleteChat(): ReturnType<typeof useMutation<DeleteChatMutation, DeleteChatMutationVariables>>;
  useAskChat(): ReturnType<typeof useMutation<AskChatMutation, AskChatMutationVariables>>;
  refreshChatLists(client: ReturnType<typeof useApolloClient>): Promise<void>;
  writeChatTitle(client: ReturnType<typeof useApolloClient>, id: string, title: string): void;
  evictChat(client: ReturnType<typeof useApolloClient>, id: string): void;
}

export const chatRepository: ChatRepository = {
  useChats(page = 1, opts) {
    return useQuery<ChatsQuery, ChatsQueryVariables>(ChatsDocument, {
      variables: { page, limit: CHAT_LIST_LIMIT },
      skip: opts?.skip,
      fetchPolicy: "cache-and-network",
      notifyOnNetworkStatusChange: true,
    });
  },

  useChat(id, opts) {
    return useQuery<ChatQuery, ChatQueryVariables>(ChatDocument, {
      variables: { id },
      skip: opts?.skip || !id,
      fetchPolicy: "cache-and-network",
      notifyOnNetworkStatusChange: true,
    });
  },

  useMessages(chatId, page = 1, opts) {
    return useQuery<ChatMessagesQuery, ChatMessagesQueryVariables>(ChatMessagesDocument, {
      variables: { chatId, page, limit: CHAT_MESSAGE_LIMIT },
      skip: opts?.skip || !chatId,
      fetchPolicy: "cache-and-network",
      notifyOnNetworkStatusChange: true,
    });
  },

  useCreateChat() {
    return useMutation<CreateChatMutation, CreateChatMutationVariables>(CreateChatDocument);
  },

  useRenameChat() {
    return useMutation<RenameChatMutation, RenameChatMutationVariables>(RenameChatDocument);
  },

  useDeleteChat() {
    return useMutation<DeleteChatMutation, DeleteChatMutationVariables>(DeleteChatDocument);
  },

  useAskChat() {
    return useMutation<AskChatMutation, AskChatMutationVariables>(AskChatDocument);
  },

  async refreshChatLists(client) {
    await client.refetchQueries({ include: ["Chats"] });
  },

  writeChatTitle(client, id, title) {
    const ref = client.cache.identify({ __typename: "Chat", id });
    if (!ref) return;
    client.cache.modify({
      id: ref,
      fields: { title: () => title },
    });
  },

  evictChat(client, id) {
    const ref = client.cache.identify({ __typename: "Chat", id });
    if (ref) client.cache.evict({ id: ref });
    client.cache.evict({ fieldName: "chatMessages" });
    client.cache.gc();
  },
};

export type {
  AskChatMutationVariables,
  ChatMessageItem,
  ChatThread,
  PaginatedChatMessages,
  PaginatedChats,
} from "./chat-documents";
