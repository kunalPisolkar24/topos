import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render-with-providers";
import { BlogHeader } from "../BlogHeader";

describe("BlogHeader", () => {
  it("renders the title", () => {
    renderWithProviders(
      <BlogHeader
        title="My Test Blog Post"
        createdAt="2024-06-15T10:00:00.000Z"
        updatedAt="2024-06-15T10:00:00.000Z"
      />,
    );
    expect(screen.getByText("My Test Blog Post")).toBeInTheDocument();
  });

  it("renders the published date", () => {
    renderWithProviders(
      <BlogHeader
        title="Test"
        createdAt="2024-06-15T10:00:00.000Z"
        updatedAt="2024-06-15T10:00:00.000Z"
      />,
    );
    expect(screen.getByText(/Published/)).toBeInTheDocument();
  });

  it("does not show updated badge when createdAt equals updatedAt", () => {
    renderWithProviders(
      <BlogHeader
        title="Test"
        createdAt="2024-06-15T10:00:00.000Z"
        updatedAt="2024-06-15T10:00:00.000Z"
      />,
    );
    expect(screen.queryByText(/Updated/)).not.toBeInTheDocument();
  });

  it("shows updated badge when createdAt differs from updatedAt", () => {
    renderWithProviders(
      <BlogHeader
        title="Test"
        createdAt="2024-06-15T10:00:00.000Z"
        updatedAt="2024-06-20T14:30:00.000Z"
      />,
    );
    expect(screen.getByText(/Updated/)).toBeInTheDocument();
  });

  it("renders the hero image when imageUrl is provided", () => {
    renderWithProviders(
      <BlogHeader
        title="Test"
        imageUrl="https://example.com/hero.png"
        createdAt="2024-06-15T10:00:00.000Z"
        updatedAt="2024-06-15T10:00:00.000Z"
      />,
    );
    expect(screen.getByRole("img", { name: "Test" })).toHaveAttribute(
      "src",
      "https://example.com/hero.png",
    );
  });

  it("does not render hero image when imageUrl is null", () => {
    renderWithProviders(
      <BlogHeader
        title="Test"
        imageUrl={null}
        createdAt="2024-06-15T10:00:00.000Z"
        updatedAt="2024-06-15T10:00:00.000Z"
      />,
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("falls back to raw string for invalid dates", () => {
    renderWithProviders(
      <BlogHeader
        title="Test"
        createdAt="not-a-date"
        updatedAt="not-a-date"
      />,
    );
    expect(screen.getByText("Published not-a-date")).toBeInTheDocument();
  });

  it("renders the Article // Topos label", () => {
    renderWithProviders(
      <BlogHeader
        title="Test"
        createdAt="2024-06-15T10:00:00.000Z"
        updatedAt="2024-06-15T10:00:00.000Z"
      />,
    );
    expect(screen.getByText("Article // Topos")).toBeInTheDocument();
  });
});
