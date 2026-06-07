import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render-with-providers";
import { AISummaryDialog } from "../AISummaryDialog";

describe("AISummaryDialog", () => {
  const defaultProps = {
    summary: null,
    summaryStatus: null,
    isOpen: true,
    onOpenChange: vi.fn(),
  };

  it("renders the trigger button", () => {
    renderWithProviders(<AISummaryDialog {...defaultProps} />);
    expect(screen.getByText("View AI Summary")).toBeInTheDocument();
  });

  it("renders summary text when status is COMPLETED", () => {
    renderWithProviders(
      <AISummaryDialog
        {...defaultProps}
        summary="This is the AI summary."
        summaryStatus="COMPLETED"
      />,
    );
    expect(screen.getByText("This is the AI summary.")).toBeInTheDocument();
  });

  it("renders summary text when status is null but summary exists", () => {
    renderWithProviders(
      <AISummaryDialog
        {...defaultProps}
        summary="Fallback summary text."
        summaryStatus={null}
      />,
    );
    expect(screen.getByText("Fallback summary text.")).toBeInTheDocument();
  });

  it("renders pending message when status is PENDING", () => {
    renderWithProviders(
      <AISummaryDialog
        {...defaultProps}
        summary={null}
        summaryStatus="PENDING"
      />,
    );
    expect(screen.getByText("Summary in Progress")).toBeInTheDocument();
    expect(
      screen.getByText(/The AI summary is being generated/),
    ).toBeInTheDocument();
  });

  it("renders unavailable message when status is other value", () => {
    renderWithProviders(
      <AISummaryDialog
        {...defaultProps}
        summary={null}
        summaryStatus="FAILED"
      />,
    );
    expect(screen.getByText("Summary Unavailable")).toBeInTheDocument();
    expect(
      screen.getByText(/The AI summary for this post is not available/),
    ).toBeInTheDocument();
  });

  it("renders unavailable message when both summary and status are null", () => {
    renderWithProviders(
      <AISummaryDialog
        {...defaultProps}
        summary={null}
        summaryStatus={null}
      />,
    );
    expect(screen.getByText("Summary Unavailable")).toBeInTheDocument();
  });

  it("renders the close button", () => {
    renderWithProviders(<AISummaryDialog {...defaultProps} />);
    expect(screen.getByText("Close")).toBeInTheDocument();
  });
});
