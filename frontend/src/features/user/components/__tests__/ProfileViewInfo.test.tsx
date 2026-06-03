import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render-with-providers";
import { ProfileViewInfo } from "../ProfileViewInfo";

describe("ProfileViewInfo", () => {
  it("renders display name and email", () => {
    renderWithProviders(
      <ProfileViewInfo
        displayName="John Doe"
        email="john@example.com"
        bio="A short bio"
        totalPosts={3}
        createdAt="2024-01-01"
      />,
    );

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("john@example.com")).toBeInTheDocument();
  });

  it("renders bio when it exists", () => {
    renderWithProviders(
      <ProfileViewInfo
        displayName="John"
        email="john@example.com"
        bio="Hello, I am John"
        totalPosts={1}
        createdAt="2024-06-01"
      />,
    );

    expect(screen.getByText("Hello, I am John")).toBeInTheDocument();
    expect(screen.queryByText("No bio added yet.")).not.toBeInTheDocument();
  });

  it("renders No bio placeholder when bio is null", () => {
    renderWithProviders(
      <ProfileViewInfo
        displayName="John"
        email="john@example.com"
        bio={null}
        totalPosts={1}
        createdAt="2024-06-01"
      />,
    );

    expect(screen.getByText("No bio added yet.")).toBeInTheDocument();
  });

  it("renders No bio placeholder when bio is undefined", () => {
    renderWithProviders(
      <ProfileViewInfo
        displayName="John"
        email="john@example.com"
        bio={undefined}
        totalPosts={1}
        createdAt="2024-06-01"
      />,
    );

    expect(screen.getByText("No bio added yet.")).toBeInTheDocument();
  });

  it("renders No bio placeholder when bio is whitespace-only", () => {
    renderWithProviders(
      <ProfileViewInfo
        displayName="John"
        email="john@example.com"
        bio="   "
        totalPosts={1}
        createdAt="2024-06-01"
      />,
    );

    expect(screen.getByText("No bio added yet.")).toBeInTheDocument();
  });

  it("shows singular Post for totalPosts === 1", () => {
    renderWithProviders(
      <ProfileViewInfo
        displayName="John"
        email="john@example.com"
        bio={null}
        totalPosts={1}
        createdAt="2024-01-01"
      />,
    );

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("Post")).toBeInTheDocument();
  });

  it("shows plural Posts for totalPosts !== 1", () => {
    renderWithProviders(
      <ProfileViewInfo
        displayName="John"
        email="john@example.com"
        bio={null}
        totalPosts={5}
        createdAt="2024-01-01"
      />,
    );

    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Posts")).toBeInTheDocument();
  });
});
