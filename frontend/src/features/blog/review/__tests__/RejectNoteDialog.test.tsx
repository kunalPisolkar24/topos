import { createRef } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render-with-providers";
import { Textarea } from "@/shared/ui/primitives/textarea";
import type { PostDraft } from "@/shared/graphql/content-documents";
import { RejectNoteDialog } from "../RejectNoteDialog";

const buildDraft = (overrides: Partial<PostDraft> = {}): PostDraft => ({
  __typename: "PostDraft",
  id: "draft-1",
  approvalId: "ap-1",
  prompt: "write about go",
  title: "Community draft title",
  body: "<p>body</p>",
  summary: "A summary",
  tags: ["go"],
  status: "PENDING",
  authorId: "author-9",
  postId: null,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  ...overrides,
});

const renderDialog = (props?: Partial<React.ComponentProps<typeof RejectNoteDialog>>) =>
  renderWithProviders(
    <RejectNoteDialog
      draft={buildDraft()}
      onOpenChange={vi.fn()}
      onConfirm={vi.fn()}
      {...props}
    />,
  );

describe("RejectNoteDialog", () => {
  it("tracks keystrokes in the counter and submits the trimmed note", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });

    const box = screen.getByLabelText(/rejection note/i);
    await user.type(box, "  needs concrete examples before this can go live  ");

    expect(screen.queryByText("0/1000")).not.toBeInTheDocument();
    expect(screen.getByText(/\/1000/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /reject draft/i }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
    expect(onConfirm.mock.calls[0][1]).toBe(
      "needs concrete examples before this can go live",
    );
    expect(
      screen.queryByText(/expected string, received undefined/),
    ).not.toBeInTheDocument();
  });

  it("shows the friendly minimum-length error and blocks submit for short notes", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });

    await user.type(screen.getByLabelText(/rejection note/i), "too short");
    await user.click(screen.getByRole("button", { name: /reject draft/i }));

    expect(
      await screen.findByText(/min 10 characters/),
    ).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe("Textarea primitive", () => {
  it("forwards ref to the underlying textarea element", () => {
    const ref = createRef<HTMLTextAreaElement>();
    renderWithProviders(<Textarea ref={ref} aria-label="note" />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });
});
