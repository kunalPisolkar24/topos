import { fireEvent, render, screen } from "@testing-library/react";
import { act, renderHook } from "@testing-library/react";
import { useWritingStudioPreview } from "../useWritingStudioPreview";
import { WritingStudioPreview } from "../WritingStudioPreview";

describe("WritingStudioPreview option rows", () => {
  it("selects tone, audience, length, and structure through segmented chips", () => {
    const { result } = renderHook(() =>
      useWritingStudioPreview({
        onTitleChange: () => {},
        onContentChange: () => {},
        onTagsChange: () => {},
        onSummaryChange: () => {},
      }),
    );
    render(<WritingStudioPreview studio={result.current} />);

    expect(result.current.brief.tone).toBe("professional");

    const witty = screen.getByRole("button", { name: "witty" });
    expect(witty).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(witty);
    expect(result.current.brief.tone).toBe("witty");

    fireEvent.click(screen.getByRole("button", { name: "expert" }));
    expect(result.current.brief.audience).toBe("expert");

    fireEvent.click(screen.getByRole("button", { name: "deep" }));
    expect(result.current.brief.length).toBe("deep");

    fireEvent.click(screen.getByRole("button", { name: "opinion" }));
    expect(result.current.brief.structure).toBe("opinion");
  });

  it("marks the active option as pressed", () => {
    const { result } = renderHook(() =>
      useWritingStudioPreview({
        onTitleChange: () => {},
        onContentChange: () => {},
        onTagsChange: () => {},
        onSummaryChange: () => {},
      }),
    );
    const { rerender } = render(
      <WritingStudioPreview studio={result.current} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "minimal" }));
    rerender(<WritingStudioPreview studio={result.current} />);
    expect(screen.getByRole("button", { name: "minimal" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "professional" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("generates an outline only after the topic is long enough", async () => {
    const { result } = renderHook(() =>
      useWritingStudioPreview({
        onTitleChange: () => {},
        onContentChange: () => {},
        onTagsChange: () => {},
        onSummaryChange: () => {},
      }),
    );
    const { rerender } = render(
      <WritingStudioPreview studio={result.current} />,
    );

    expect(
      screen.getByRole("button", { name: /generate outline/i }),
    ).toBeDisabled();

    await act(async () => {
      result.current.setBriefField("topic", "a".repeat(31));
    });
    rerender(<WritingStudioPreview studio={result.current} />);
    expect(
      screen.getByRole("button", { name: /generate outline/i }),
    ).not.toBeDisabled();
  });
});
