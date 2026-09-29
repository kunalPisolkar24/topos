import type React from "react";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render-with-providers";
import { BlogAuthorSidebar } from "../BlogAuthorSidebar";

const baseAuthor = {
  id: "author-1",
  name: "Ramu Author",
  username: "ramu33",
  email: "ramu33@example.com",
  avatarUrl: null,
  bio: "Software developer who enjoys photography.",
};

const renderSidebar = (
  author: React.ComponentProps<typeof BlogAuthorSidebar>["author"],
) =>
  renderWithProviders(
    <BlogAuthorSidebar
      author={author}
      isAuthor={false}
      isEditing={false}
      onEdit={() => {}}
      onDelete={() => {}}
      isDeleting={false}
      isDeleteDialogOpen={false}
      setIsDeleteDialogOpen={() => {}}
    />,
  );

describe("BlogAuthorSidebar email row", () => {
  it("shows the email when the author shares it", () => {
    renderSidebar(baseAuthor);

    expect(screen.getByText("ramu33@example.com")).toBeInTheDocument();
    expect(screen.getByText("Ramu Author")).toBeInTheDocument();
  });

  it("hides the email row when the address is private", () => {
    renderSidebar({ ...baseAuthor, email: null });

    expect(screen.queryByText("ramu33@example.com")).not.toBeInTheDocument();
    expect(screen.getByText("Ramu Author")).toBeInTheDocument();
    expect(screen.getByText("@ramu33")).toBeInTheDocument();
    expect(
      screen.getByText("Software developer who enjoys photography."),
    ).toBeInTheDocument();
  });

  it("hides the email row when the address is an empty string", () => {
    renderSidebar({ ...baseAuthor, email: "" });

    expect(screen.queryByText("ramu33@example.com")).not.toBeInTheDocument();
    expect(screen.getByText("@ramu33")).toBeInTheDocument();
  });
});
