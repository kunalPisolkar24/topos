import { act, renderHook } from "@testing-library/react";
import { MIN_PROMPT_LENGTH } from "@/entities/post/lib";
import type { WritingBrief } from "../types";
import { useWritingStudioPreview } from "../useWritingStudioPreview";

const renderStudio = (onApplied?: (brief: WritingBrief) => void) => {
  const onTitleChange = vi.fn();
  const onContentChange = vi.fn();
  const onTagsChange = vi.fn();
  const onSummaryChange = vi.fn();
  const utils = renderHook(() =>
    useWritingStudioPreview({
      onTitleChange,
      onContentChange,
      onTagsChange,
      onSummaryChange,
      ...(onApplied ? { onApplied } : {}),
    }),
  );
  return {
    ...utils,
    onTitleChange,
    onContentChange,
    onTagsChange,
    onSummaryChange,
  };
};

describe("useWritingStudioPreview", () => {
  it("stays on the brief step until the topic is long enough", () => {
    const { result } = renderStudio();

    expect(result.current.step).toBe("brief");
    expect(result.current.canGenerateOutline).toBe(false);

    act(() => {
      result.current.setBriefField("topic", "a".repeat(MIN_PROMPT_LENGTH + 1));
    });
    expect(result.current.canGenerateOutline).toBe(true);
  });

  it("generates an outline, reorders it, and expands to draft", async () => {
    const { result } = renderStudio();

    act(() => {
      result.current.setBriefField("topic", "a".repeat(MIN_PROMPT_LENGTH + 1));
    });
    await act(async () => {
      await result.current.generateOutline();
    });

    expect(result.current.step).toBe("outline");
    expect(result.current.outline).toHaveLength(5);

    const firstId = result.current.outline[0].id;
    act(() => result.current.moveSection(firstId, 1));
    expect(result.current.outline[1].id).toBe(firstId);

    await act(async () => {
      await result.current.expandAll();
    });
    expect(result.current.step).toBe("draft");
    expect(result.current.canApply).toBe(true);
  });

  it("removes a section and applies the preview to the editor", async () => {
    const onApplied = vi.fn();
    const { result, onTitleChange, onContentChange, onTagsChange } =
      renderStudio(onApplied);

    act(() => {
      result.current.setBriefField("topic", "a".repeat(MIN_PROMPT_LENGTH + 1));
    });
    await act(async () => {
      await result.current.generateOutline();
    });
    await act(async () => {
      await result.current.expandAll();
    });

    const removeId = result.current.outline[0].id;
    act(() => result.current.removeSection(removeId));
    expect(
      result.current.outline.find((section) => section.id === removeId),
    ).toBeUndefined();

    act(() => result.current.applyToEditor());
    expect(onTitleChange).toHaveBeenCalled();
    expect(onContentChange).toHaveBeenCalled();
    expect(onTagsChange).toHaveBeenCalled();
    expect(onApplied).toHaveBeenCalledWith(
      expect.objectContaining({ tone: "professional", structure: "how-to" }),
    );
  });
});
