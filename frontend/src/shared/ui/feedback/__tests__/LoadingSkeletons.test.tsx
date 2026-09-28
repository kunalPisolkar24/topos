import { render, screen } from "@testing-library/react";
import { ChatThreadSkeleton } from "@/features/chat/components/ChatThreadSkeleton";
import { ChatSidebarSkeleton } from "@/features/chat/components/ChatSidebarSkeleton";
import { DraftCardSkeleton } from "../DraftCardSkeleton";
import { DraftDetailSkeleton } from "../DraftDetailSkeleton";
import { RouteShellSkeleton } from "../RouteShellSkeleton";

describe("loading skeletons", () => {
  it("renders the chat thread skeleton with blueprint styling", () => {
    const { container } = render(<ChatThreadSkeleton />);
    expect(screen.getByRole("status", { name: /loading messages/i })).toBeInTheDocument();
    expect(container.querySelectorAll(".rounded-none").length).toBeGreaterThan(0);
    expect(container.querySelector(".rounded-md")).toBeNull();
  });

  it("renders the chat sidebar skeleton rows", () => {
    const { container } = render(<ChatSidebarSkeleton rows={3} />);
    expect(screen.getByRole("status", { name: /loading chats/i })).toBeInTheDocument();
    expect(container.querySelectorAll(".rounded-none").length).toBeGreaterThan(0);
  });

  it("renders the draft card skeleton", () => {
    render(<DraftCardSkeleton />);
    expect(screen.getByRole("status", { name: /loading draft/i })).toBeInTheDocument();
  });

  it("renders the draft detail skeleton", () => {
    render(<DraftDetailSkeleton />);
    expect(screen.getByRole("status", { name: /loading draft/i })).toBeInTheDocument();
  });

  it("renders the route shell skeleton", () => {
    render(<RouteShellSkeleton />);
    expect(screen.getByRole("status", { name: /loading page/i })).toBeInTheDocument();
  });
});
