import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render-with-providers";
import { sessionStoreActions } from "@/entities/session";
import { ChatSidebar } from "../components/ChatSidebar";
import type { ChatThread } from "@/entities/chat/api/chat-documents";

const chats: ChatThread[] = [
  {
    __typename: "Chat",
    id: "chat-1",
    title: "First chat",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-02T00:00:00.000Z",
  },
];

const baseProps = {
  activeChatId: "chat-1",
  isCreating: false,
  hasError: false,
  onSelect: vi.fn(),
  onCreate: vi.fn(),
  onRename: vi.fn(),
  onDelete: vi.fn(),
  onRetry: vi.fn(),
};

describe("ChatSidebar", () => {
  beforeEach(() => {
    sessionStoreActions.markAuthenticated("test-token");
  });

  it("keeps the mounted list during background refetches", () => {
    renderWithProviders(<ChatSidebar {...baseProps} chats={chats} isLoading />);

    expect(screen.getByText("First chat")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: /loading chats/i })).not.toBeInTheDocument();
  });

  it("shows the loading state only when no chats are cached", () => {
    renderWithProviders(<ChatSidebar {...baseProps} chats={[]} activeChatId={null} isLoading />);

    expect(screen.getByRole("status", { name: /loading chats/i })).toBeInTheDocument();
  });

  it("disables the New button while a chat is being created", () => {
    renderWithProviders(<ChatSidebar {...baseProps} chats={chats} isLoading={false} isCreating />);

    expect(screen.getByRole("button", { name: /start new chat/i })).toBeDisabled();
  });
});
