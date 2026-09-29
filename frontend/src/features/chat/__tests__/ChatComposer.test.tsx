import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render-with-providers";
import { sessionStoreActions } from "@/entities/session";
import { ChatComposer } from "../components/ChatComposer";

describe("ChatComposer", () => {
  beforeEach(() => {
    sessionStoreActions.markAuthenticated("test-token");
  });

  it("sends on Enter and keeps Shift+Enter as a newline", async () => {
    const user = userEvent.setup();
    const onAsk = vi.fn();
    const onStop = vi.fn();

    renderWithProviders(
      <ChatComposer isAsking={false} askError={null} onAsk={onAsk} onStop={onStop} />,
    );

    const input = screen.getByLabelText("Chat message");
    await user.type(input, "Hello Topos{enter}");

    expect(onAsk).toHaveBeenCalledTimes(1);
    expect(onAsk).toHaveBeenCalledWith("Hello Topos");
    expect(input).toHaveValue("");

    await user.type(input, "line one{shift>}{enter}{/shift}line two");
    expect(input).toHaveValue("line one\nline two");
    expect(onAsk).toHaveBeenCalledTimes(1);
  });

  it("shows Stop while asking and surfaces errors", async () => {
    const user = userEvent.setup();
    const onAsk = vi.fn();
    const onStop = vi.fn();

    const { rerender } = renderWithProviders(
      <ChatComposer isAsking={false} askError="Too short" onAsk={onAsk} onStop={onStop} />,
    );
    expect(screen.getByText("Too short")).toBeInTheDocument();

    rerender(<ChatComposer isAsking askError={null} onAsk={onAsk} onStop={onStop} />);
    await user.click(screen.getByRole("button", { name: /stop generating/i }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});
