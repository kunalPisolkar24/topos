import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render-with-providers";
import { sessionStoreActions } from "@/entities/session";
import { ChatThread } from "../components/ChatThread";
import type { ChatMessageView } from "../useChatController";

const baseProps = {
  isLoading: false,
  hasError: false,
  isAsking: false,
  streamingContent: "",
  onRetry: vi.fn(),
  onSuggest: vi.fn(),
};

describe("ChatThread", () => {
  beforeEach(() => {
    sessionStoreActions.markAuthenticated("test-token");
  });

  it("renders suggestion chips that fire immediately on click", async () => {
    const user = userEvent.setup();
    const onSuggest = vi.fn();

    renderWithProviders(<ChatThread {...baseProps} messages={[]} onSuggest={onSuggest} />);

    expect(screen.getByText("Start with a question")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /what covers idempotency/i }));
    expect(onSuggest).toHaveBeenCalledTimes(1);
    expect(onSuggest).toHaveBeenCalledWith("What covers idempotency on Topos?");
  });

  it("labels roles with timestamps in chronological order", () => {
    const messages: ChatMessageView[] = [
      {
        __typename: "ChatMessage",
        id: "m1",
        chatId: "c1",
        role: "USER",
        content: "Hello?",
        citedPostIds: [],
        createdAt: "2025-09-16T10:00:00.000Z",
      },
      {
        __typename: "ChatMessage",
        id: "m2",
        chatId: "c1",
        role: "ASSISTANT",
        content: "Hi there.",
        citedPostIds: ["post-15"],
        createdAt: "2025-09-16T10:01:00.000Z",
      },
    ];

    renderWithProviders(<ChatThread {...baseProps} messages={messages} />);

    expect(screen.getByText(/you ·/i)).toBeInTheDocument();
    expect(screen.getByText(/topos ai ·/i)).toBeInTheDocument();
    const userBubble = screen.getByText("Hello?").closest("div");
    const answerBubble = screen.getByText("Hi there.").closest("div");
    expect(userBubble?.compareDocumentPosition(answerBubble as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});
