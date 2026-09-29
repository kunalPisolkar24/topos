import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render-with-providers";
import { DraftSummary } from "../DraftSummary";

describe("DraftSummary", () => {
  it("renders the summary text when present", () => {
    renderWithProviders(<DraftSummary summary="A real summary." />);
    expect(screen.getByText("A real summary.")).toBeInTheDocument();
    expect(screen.queryByText("No summary yet.")).not.toBeInTheDocument();
  });

  it("renders the full empty state for blank summary", () => {
    renderWithProviders(<DraftSummary summary="   " variant="full" />);
    expect(screen.getByText("No summary yet.")).toBeInTheDocument();
  });

  it("renders the compact empty state for null summary", () => {
    renderWithProviders(<DraftSummary summary={null} variant="compact" />);
    expect(screen.getByText("No summary yet.")).toBeInTheDocument();
  });
});
