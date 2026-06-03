import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render-with-providers";
import { BlogTitleSection } from "../BlogTitleSection";

describe("BlogTitleSection", () => {
  it("renders the title input with the Merriweather typography hook", () => {
    renderWithProviders(
      <BlogTitleSection value="" onChange={() => {}} />,
    );

    const input = screen.getByPlaceholderText(/write a clear, specific headline/i);

    expect(input).toBeInTheDocument();
    expect(input).toHaveClass("blog-title-input");
  });

  it("forwards typed value changes to the consumer", () => {
    const onChange = vi.fn();
    renderWithProviders(
      <BlogTitleSection value="" onChange={onChange} />,
    );

    const input = screen.getByPlaceholderText(/write a clear, specific headline/i);
    fireEvent.change(input, { target: { value: "A precise headline" } });

    expect(onChange).toHaveBeenCalledWith("A precise headline");
  });
});
