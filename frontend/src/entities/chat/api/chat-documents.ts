import { gql } from "@apollo/client";
import type { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core";

// Hand-written preview-first documents for the RAG chat surface. They mirror
// services/content/graph/schema.graphqls (Chat, ChatMessage, PaginatedChats,
// PaginatedMessages) so the future backend can adopt them via codegen.

export type ChatRole = "USER" | "ASSISTANT";

export interface ChatThread {
  __typename?: "Chat";
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageItem {
  __typename?: "ChatMessage";
  id: string;
  chatId: string;
  role: ChatRole;
  content: string;
  citedPostIds: string[];
  createdAt: string;
}

export interface PaginatedChats {
  __typename?: "PaginatedChats";
  chats: ChatThread[];
  totalPages: number;
  currentPage: number;
  totalChats: number;
}

export interface PaginatedChatMessages {
  __typename?: "PaginatedMessages";
  messages: ChatMessageItem[];
  totalPages: number;
  currentPage: number;
  totalMessages: number;
}

export interface ChatsQueryVariables {
  page?: number;
  limit?: number;
}

export interface ChatsQuery {
  __typename?: "Query";
  chats: PaginatedChats;
}

export interface ChatQueryVariables {
  id: string;
}

export interface ChatQuery {
  __typename?: "Query";
  chat?: ChatThread | null;
}

export interface ChatMessagesQueryVariables {
  chatId: string;
  page?: number;
  limit?: number;
}

export interface ChatMessagesQuery {
  __typename?: "Query";
  chatMessages: PaginatedChatMessages;
}

export interface CreateChatMutationVariables {
  title?: string | null;
}

export interface CreateChatMutation {
  __typename?: "Mutation";
  createChat: ChatThread;
}

export interface RenameChatMutationVariables {
  id: string;
  title: string;
}

export interface RenameChatMutation {
  __typename?: "Mutation";
  renameChat: ChatThread;
}

export interface DeleteChatMutationVariables {
  id: string;
}

export interface DeleteChatMutation {
  __typename?: "Mutation";
  deleteChat: boolean;
}

export interface AskChatMutationVariables {
  chatId: string;
  query: string;
}

export interface AskChatMutation {
  __typename?: "Mutation";
  askChat: ChatMessageItem;
}

const CHAT_FIELDS = gql`
  fragment ChatFields on Chat {
    id
    title
    createdAt
    updatedAt
  }
`;

const CHAT_MESSAGE_FIELDS = gql`
  fragment ChatMessageFields on ChatMessage {
    id
    chatId
    role
    content
    citedPostIds
    createdAt
  }
`;

export const ChatsDocument = gql`
  query Chats($page: Int, $limit: Int) {
    chats(page: $page, limit: $limit) {
      chats {
        ...ChatFields
      }
      totalPages
      currentPage
      totalChats
    }
  }
  ${CHAT_FIELDS}
` as DocumentNode<ChatsQuery, ChatsQueryVariables>;

export const ChatDocument = gql`
  query Chat($id: ID!) {
    chat(id: $id) {
      ...ChatFields
    }
  }
  ${CHAT_FIELDS}
` as DocumentNode<ChatQuery, ChatQueryVariables>;

export const ChatMessagesDocument = gql`
  query ChatMessages($chatId: ID!, $page: Int, $limit: Int) {
    chatMessages(chatId: $chatId, page: $page, limit: $limit) {
      messages {
        ...ChatMessageFields
      }
      totalPages
      currentPage
      totalMessages
    }
  }
  ${CHAT_MESSAGE_FIELDS}
` as DocumentNode<ChatMessagesQuery, ChatMessagesQueryVariables>;

export const CreateChatDocument = gql`
  mutation CreateChat($title: String) {
    createChat(title: $title) {
      ...ChatFields
    }
  }
  ${CHAT_FIELDS}
` as DocumentNode<CreateChatMutation, CreateChatMutationVariables>;

export const RenameChatDocument = gql`
  mutation RenameChat($id: ID!, $title: String!) {
    renameChat(id: $id, title: $title) {
      ...ChatFields
    }
  }
  ${CHAT_FIELDS}
` as DocumentNode<RenameChatMutation, RenameChatMutationVariables>;

export const DeleteChatDocument = gql`
  mutation DeleteChat($id: ID!) {
    deleteChat(id: $id)
  }
` as DocumentNode<DeleteChatMutation, DeleteChatMutationVariables>;

export const AskChatDocument = gql`
  mutation AskChat($chatId: ID!, $query: String!) {
    askChat(chatId: $chatId, query: $query) {
      ...ChatMessageFields
    }
  }
  ${CHAT_MESSAGE_FIELDS}
` as DocumentNode<AskChatMutation, AskChatMutationVariables>;
