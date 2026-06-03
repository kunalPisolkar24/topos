import { forwardRef, createRef } from "react";
import { render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type ReactQuill from "react-quill-new";
import { BlogEditor } from "../BlogEditor";

class ResizeObserverMock {
  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();
}

vi.mock("react-quill-new", () => {
  const ReactQuillMock = forwardRef<
    HTMLDivElement,
    { onChange?: (value: string) => void }
  >(({ onChange }, ref) => (
    <div
      data-testid="react-quill-mock"
      ref={(node) => {
        if (typeof ref === "function") {
          ref(node as unknown as Parameters<NonNullable<typeof ref>>[0]);
        } else if (ref && typeof ref === "object") {
          (ref as { current: HTMLDivElement | null }).current = node;
        }
      }}
    >
      <textarea
        data-testid="react-quill-textarea"
        onChange={(event) => onChange?.(event.target.value)}
      />
    </div>
  ));
  ReactQuillMock.displayName = "ReactQuill";
  return { default: ReactQuillMock };
});

describe("BlogEditor", () => {
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  it("renders the body section with the responsive toolbar", () => {
    render(<BlogEditor value="" onChange={() => {}} />);

    expect(screen.getByText(/04 \/\/ body/i)).toBeInTheDocument();
    expect(screen.getByText(/long-form editor/i)).toBeInTheDocument();
    expect(
      screen.getByRole("toolbar", { name: /long-form editor toolbar/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("react-quill-mock")).toBeInTheDocument();
  });

  it("forwards the quill ref to the consumer", () => {
    const ref = createRef<ReactQuill>();
    render(<BlogEditor ref={ref} value="" onChange={() => {}} />);

    expect(ref.current).not.toBeNull();
  });

  it("invokes onChange with the new value when the underlying editor changes", () => {
    const onChange = vi.fn();
    render(<BlogEditor value="" onChange={onChange} />);

    const textarea = screen.getByTestId("react-quill-textarea");
    textarea.textContent = "Hello world";
    textarea.dispatchEvent(new Event("change", { bubbles: true }));

    expect(onChange).toHaveBeenCalledWith("Hello world");
  });
});
