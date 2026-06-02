import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { MutableRefObject } from "react";
import type ReactQuill from "react-quill-new";
import { ResponsiveRichTextToolbar } from "../ResponsiveRichTextToolbar";

class ResizeObserverMock {
  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();
}

type EditorListener = (event: { index: number; length: number } | null) => void;

interface MockQuill {
  focus: ReturnType<typeof vi.fn>;
  format: ReturnType<typeof vi.fn>;
  removeFormat: ReturnType<typeof vi.fn>;
  getFormat: ReturnType<typeof vi.fn>;
  getSelection: ReturnType<typeof vi.fn>;
  getLength: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  getModule: ReturnType<typeof vi.fn>;
  __emit: (event: "text-change" | "selection-change") => void;
}

function createMockQuill(initial: Record<string, unknown> = {}): MockQuill {
  const listeners: Record<string, EditorListener[]> = {
    "text-change": [],
    "selection-change": [],
  };

  const quill: MockQuill = {
    focus: vi.fn(),
    format: vi.fn(),
    removeFormat: vi.fn(),
    getFormat: vi.fn(() => initial),
    getSelection: vi.fn(() => ({ index: 0, length: 0 })),
    getLength: vi.fn(() => 1),
    on: vi.fn((event: "text-change" | "selection-change", handler: EditorListener) => {
      listeners[event].push(handler);
      return quill;
    }),
    off: vi.fn((event: "text-change" | "selection-change", handler: EditorListener) => {
      listeners[event] = listeners[event].filter((h) => h !== handler);
      return quill;
    }),
    getModule: vi.fn(() => undefined),
    __emit: (event) => {
      for (const handler of listeners[event]) handler({ index: 0, length: 0 });
    },
  };

  return quill;
}

function makeRef(quill: MockQuill) {
  const ref = { getEditor: () => quill } as unknown as ReactQuill;
  return { current: ref } as MutableRefObject<ReactQuill | null>;
}

describe("ResponsiveRichTextToolbar", () => {
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  it("renders a toolbar with the priority formatting controls", () => {
    const quill = createMockQuill();
    render(<ResponsiveRichTextToolbar quillRef={makeRef(quill)} />);

    const toolbar = screen.getByRole("toolbar", { name: /long-form editor toolbar/i });
    expect(toolbar).toBeInTheDocument();

    expect(within(toolbar).getByRole("button", { name: /^bold$/i })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: /^italic$/i })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: /^underline$/i })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: /^bullet list$/i })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: /^numbered list$/i })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: /^link$/i })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: /^image$/i })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: /heading style/i })).toBeInTheDocument();
  });

  it("hides secondary formatting controls behind a more menu on small screens", () => {
    const quill = createMockQuill();
    render(<ResponsiveRichTextToolbar quillRef={makeRef(quill)} />);

    const toolbar = screen.getByRole("toolbar", { name: /long-form editor toolbar/i });
    const secondaryGroup = toolbar.querySelector("[data-slot='rich-text-toolbar-secondary']");
    expect(secondaryGroup).not.toBeNull();
    expect(secondaryGroup).toHaveClass("hidden");
    expect(
      within(toolbar).getByRole("button", { name: /more formatting options/i }),
    ).toBeInTheDocument();
  });

  it("exposes secondary formatting controls in the more menu when opened", async () => {
    const user = userEvent.setup();
    const quill = createMockQuill();
    render(<ResponsiveRichTextToolbar quillRef={makeRef(quill)} />);

    await user.click(screen.getByRole("button", { name: /more formatting options/i }));

    expect(
      screen.getByRole("menuitem", { name: /indent less/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /indent more/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /align left/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /video/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /blockquote/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /code block/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /clear formatting/i })).toBeInTheDocument();
  });

  it("toggles bold formatting on the editor when the bold button is clicked", async () => {
    const user = userEvent.setup();
    const quill = createMockQuill();
    render(<ResponsiveRichTextToolbar quillRef={makeRef(quill)} />);

    await user.click(screen.getByRole("button", { name: /^bold$/i }));

    expect(quill.focus).toHaveBeenCalled();
    expect(quill.format).toHaveBeenCalledWith("bold", true);
  });

  it("reflects the current active state for bold from the editor", () => {
    const quill = createMockQuill({ bold: true });
    render(<ResponsiveRichTextToolbar quillRef={makeRef(quill)} />);

    const boldButton = screen.getByRole("button", { name: /^bold$/i });
    expect(boldButton).toHaveAttribute("aria-pressed", "true");
  });

  it("updates the active state when the editor selection changes", async () => {
    const quill = createMockQuill();
    render(<ResponsiveRichTextToolbar quillRef={makeRef(quill)} />);

    quill.getFormat.mockReturnValue({ italic: true });
    await act(async () => {
      quill.__emit("selection-change");
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
    });

    const italicButton = screen.getByRole("button", { name: /^italic$/i });
    expect(italicButton).toHaveAttribute("aria-pressed", "true");
  });

  it("invokes the image upload handler when the image button is clicked", async () => {
    const user = userEvent.setup();
    const handleImageUpload = vi.fn();
    const quill = createMockQuill();
    render(
      <ResponsiveRichTextToolbar
        quillRef={makeRef(quill)}
        onImageUpload={handleImageUpload}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^image$/i }));

    expect(handleImageUpload).toHaveBeenCalledTimes(1);
  });

  it("clears all formatting when the clear formatting action is selected", async () => {
    const user = userEvent.setup();
    const quill = createMockQuill();
    quill.getLength.mockReturnValue(12);
    render(<ResponsiveRichTextToolbar quillRef={makeRef(quill)} />);

    await user.click(screen.getByRole("button", { name: /more formatting options/i }));
    await user.click(screen.getByRole("menuitem", { name: /clear formatting/i }));

    expect(quill.removeFormat).toHaveBeenCalledWith(0, 12);
  });

  it("applies a numbered list when the corresponding priority button is pressed", async () => {
    const user = userEvent.setup();
    const quill = createMockQuill();
    render(<ResponsiveRichTextToolbar quillRef={makeRef(quill)} />);

    await user.click(screen.getByRole("button", { name: /^numbered list$/i }));

    expect(quill.format).toHaveBeenCalledWith("list", "ordered");
  });

  it("removes a list when its active priority button is pressed again", async () => {
    const user = userEvent.setup();
    const quill = createMockQuill({ list: "bullet" });
    render(<ResponsiveRichTextToolbar quillRef={makeRef(quill)} />);

    await user.click(screen.getByRole("button", { name: /^bullet list$/i }));

    expect(quill.format).toHaveBeenCalledWith("list", false);
  });

  it("cycles the alignment when the align action is triggered", async () => {
    const user = userEvent.setup();
    const quill = createMockQuill();
    render(<ResponsiveRichTextToolbar quillRef={makeRef(quill)} />);

    await user.click(screen.getByRole("button", { name: /more formatting options/i }));
    await user.click(screen.getByRole("menuitem", { name: /align left/i }));

    expect(quill.format).toHaveBeenCalledWith("align", "center");
  });

  it("applies the selected heading style from the header picker", async () => {
    const user = userEvent.setup();
    const quill = createMockQuill();
    render(<ResponsiveRichTextToolbar quillRef={makeRef(quill)} />);

    await user.click(screen.getByRole("button", { name: /heading style/i }));
    await user.click(screen.getByRole("menuitem", { name: /heading 2/i }));

    expect(quill.format).toHaveBeenCalledWith("header", 2);
  });

  it("does not steal focus from sibling inputs when the editor selection changes", async () => {
    const quill = createMockQuill();
    quill.getSelection.mockReturnValue(null);
    render(<ResponsiveRichTextToolbar quillRef={makeRef(quill)} />);

    quill.focus.mockClear();
    quill.getFormat.mockClear();

    await act(async () => {
      quill.__emit("selection-change");
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
    });

    expect(quill.focus).not.toHaveBeenCalled();
    expect(quill.getFormat).not.toHaveBeenCalledWith();
  });

  it("reads format state at the current selection range, not via the focusing default", async () => {
    const quill = createMockQuill();
    quill.getSelection.mockReturnValue({ index: 3, length: 7 });
    render(<ResponsiveRichTextToolbar quillRef={makeRef(quill)} />);

    quill.getFormat.mockClear();

    await act(async () => {
      quill.__emit("text-change");
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
    });

    expect(quill.getFormat).toHaveBeenCalledWith(3, 7);
    expect(quill.focus).not.toHaveBeenCalled();
  });
});
