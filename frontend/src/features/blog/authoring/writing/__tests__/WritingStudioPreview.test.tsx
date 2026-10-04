import { render, screen } from "@testing-library/react";
import { act, renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useWritingStudioPreview } from "../useWritingStudioPreview";
import { WritingStudioPreview } from "../WritingStudioPreview";

const renderStudio = () => {
  const hook = renderHook(() =>
    useWritingStudioPreview({
      onTitleChange: () => {},
      onContentChange: () => {},
      onTagsChange: () => {},
      onSummaryChange: () => {},
    }),
  );
  const view = render(<WritingStudioPreview studio={hook.result.current} />);
  return { hook, view };
};

const selectOption = async (label: string, option: string) => {
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox", { name: label }));
  await user.click(screen.getByRole("option", { name: option }));
};

describe("WritingStudioPreview selects", () => {
  it("selects tone, audience, length, and structure through dropdowns", async () => {
    const { hook, view } = renderStudio();
    expect(hook.result.current.brief.tone).toBe("professional");

    await selectOption("Tone", "witty");
    view.rerender(<WritingStudioPreview studio={hook.result.current} />);
    expect(hook.result.current.brief.tone).toBe("witty");
    expect(screen.getByRole("combobox", { name: "Tone" })).toHaveTextContent(
      "witty",
    );

    await selectOption("Audience", "expert");
    expect(hook.result.current.brief.audience).toBe("expert");

    await selectOption("Length", "deep");
    expect(hook.result.current.brief.length).toBe("deep");

    await selectOption("Structure", "opinion");
    expect(hook.result.current.brief.structure).toBe("opinion");
  });

  it("generates an outline only after the topic is long enough", async () => {
    const { hook, view } = renderStudio();

    expect(
      screen.getByRole("button", { name: /generate outline/i }),
    ).toBeDisabled();

    await act(async () => {
      hook.result.current.setBriefField("topic", "a".repeat(31));
    });
    view.rerender(<WritingStudioPreview studio={hook.result.current} />);
    expect(
      screen.getByRole("button", { name: /generate outline/i }),
    ).not.toBeDisabled();
  });
});
