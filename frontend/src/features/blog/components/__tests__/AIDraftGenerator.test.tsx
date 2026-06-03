import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render-with-providers";
import { AIDraftGenerator } from "../AIDraftGenerator";

const baseProps = {
  prompt: "",
  onPromptChange: () => {},
  onGenerate: () => {},
  isGenerating: false,
  canGenerate: false,
  onClear: () => {},
  summary: null,
  isSummaryVisible: false,
  onToggleSummary: () => {},
};

describe("AIDraftGenerator", () => {
  it("renders the draft textarea with the Merriweather typography hook", () => {
    renderWithProviders(<AIDraftGenerator {...baseProps} />);

    const textarea = screen.getByPlaceholderText(
      /describe the reader, argument, structure, and constraints/i,
    );

    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveClass("blog-draft-input");
  });

  it("forwards prompt changes to the consumer", () => {
    const onPromptChange = vi.fn();
    renderWithProviders(
      <AIDraftGenerator {...baseProps} onPromptChange={onPromptChange} />,
    );

    const textarea = screen.getByPlaceholderText(
      /describe the reader, argument, structure, and constraints/i,
    );
    fireEvent.change(textarea, { target: { value: "Outline the post" } });

    expect(onPromptChange).toHaveBeenCalledWith("Outline the post");
  });
});
