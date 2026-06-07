import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test/render-with-providers";
import { BlogBody } from "../BlogBody";

describe("BlogBody", () => {
  it("renders the sanitized body content", () => {
    renderWithProviders(<BlogBody body="<p>Hello world</p>" tags={[]} />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders the Body label", () => {
    renderWithProviders(<BlogBody body="<p>Content</p>" tags={[]} />);
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  it("renders tag buttons when tags are provided", () => {
    renderWithProviders(
      <BlogBody
        body="<p>Content</p>"
        tags={[
          { id: "1", name: "React" },
          { id: "2", name: "TypeScript" },
        ]}
      />,
    );
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
  });

  it("does not render tags section when tags array is empty", () => {
    const { container } = renderWithProviders(
      <BlogBody body="<p>Content</p>" tags={[]} />,
    );
    expect(container.querySelector("button")).toBeNull();
  });

  it("navigates to search page when a tag is clicked", () => {
    renderWithProviders(
      <BlogBody
        body="<p>Content</p>"
        tags={[{ id: "1", name: "React" }]}
      />,
    );
    fireEvent.click(screen.getByText("React"));
  });

  it("sanitizes script tags from the body", () => {
    renderWithProviders(
      <BlogBody body="<p>Safe</p><script>alert('xss')</script>" tags={[]} />,
    );
    expect(screen.getByText("Safe")).toBeInTheDocument();
    expect(screen.queryByText(/alert/)).not.toBeInTheDocument();
  });
});
