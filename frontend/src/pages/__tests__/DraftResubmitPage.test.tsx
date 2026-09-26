import { HttpResponse, graphql } from "msw";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders } from "@/test/render-with-providers";
import { server } from "@/test/server";
import { sessionStoreActions } from "@/entities/session";
import DraftResubmitPage from "../DraftResubmitPage";

vi.mock("@/widgets", async () => {
  const React = await import("react");
  return {
    StickyNavbar: () => React.createElement("div", { "data-testid": "navbar" }),
    BlogEditor: ({
      value,
      onChange,
    }: {
      value: string;
      onChange: (value: string) => void;
    }) =>
      React.createElement("textarea", {
        "aria-label": "Body editor",
        value,
        onChange: (event: { target: { value: string } }) =>
          onChange(event.target.value),
      }),
  };
});

const graphqlApi = graphql.link("http://localhost:4000/graphql");

const meUser = {
  __typename: "User",
  id: "me-1",
  username: "meuser",
  email: "me@topos.dev",
  name: "Me User",
  bio: null,
  avatarUrl: null,
  bannerUrl: null,
  createdAt: new Date().toISOString(),
};

const reviewerUser = {
  __typename: "User",
  id: "reviewer-9",
  username: "peerreviewer",
  email: "peer@topos.dev",
  name: "Peer Reviewer",
  bio: null,
  avatarUrl: null,
  bannerUrl: null,
  createdAt: new Date().toISOString(),
};

const buildRejectedDraft = (overrides: Record<string, unknown> = {}) => ({
  __typename: "PostDraft",
  id: "d9",
  approvalId: "ap-9",
  prompt: "write about go",
  title: "Rejected draft title",
  body: "<p>rejected body</p>",
  summary: "Draft summary",
  tags: ["go"],
  imageUrl: "https://cdn/cover.png",
  status: "REJECTED",
  author: {
    __typename: "User",
    id: "me-1",
    username: "meuser",
    name: "Me User",
    avatarUrl: null,
  },
  authorId: "me-1",
  postId: "post-9",
  reviewedById: reviewerUser.id,
  reviewedAt: "2024-02-01T00:00:00.000Z",
  rejectionNote: "Needs a stronger intro",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  ...overrides,
});

const emptyDrafts = {
  __typename: "PaginatedPostDrafts",
  drafts: [],
  totalPages: 1,
  currentPage: 1,
  totalDrafts: 0,
};

const setupHandlers = (mineDrafts: Record<string, unknown>[]) => {
  server.use(
    graphqlApi.query("Me", () =>
      HttpResponse.json({ data: { me: meUser } }),
    ),
    graphqlApi.query("PostDrafts", () =>
      HttpResponse.json({ data: { postDrafts: emptyDrafts } }),
    ),
    graphqlApi.query("MyPostDrafts", () =>
      HttpResponse.json({
        data: {
          myPostDrafts: {
            ...emptyDrafts,
            drafts: mineDrafts,
            totalDrafts: mineDrafts.length,
          },
        },
      }),
    ),
    graphqlApi.query("User", async ({ variables }) => {
      const id = (variables as { id?: string })?.id;
      return HttpResponse.json({
        data: { user: id === reviewerUser.id ? reviewerUser : null },
      });
    }),
  );
};

const renderResubmitPage = () =>
  renderWithProviders(
    <Routes>
      <Route path="/review/:draftId/edit" element={<DraftResubmitPage />} />
      <Route path="/review/:draftId" element={<div>draft-detail-page</div>} />
    </Routes>,
    { route: "/review/d9/edit" },
  );

describe("DraftResubmitPage", () => {
  beforeEach(() => {
    sessionStoreActions.markAuthenticated("test-token");
  });

  it("shows the rejection note and prefills the update-post-style editor", async () => {
    setupHandlers([buildRejectedDraft()]);
    renderResubmitPage();

    expect(
      await screen.findByText("Revise your rejected draft."),
    ).toBeInTheDocument();
    expect(screen.getByText("Needs a stronger intro")).toBeInTheDocument();
    expect(screen.getByLabelText(/Public title/)).toHaveValue(
      "Rejected draft title",
    );
    expect(screen.getByLabelText(/Body editor/)).toHaveValue(
      "<p>rejected body</p>",
    );
    expect(
      screen.getByRole("button", { name: "Resubmit for review" }),
    ).toBeInTheDocument();
  });

  it("resubmits with the banner image and post link, then returns to the draft", async () => {
    setupHandlers([buildRejectedDraft()]);
    const seen: unknown[] = [];
    server.use(
      graphqlApi.mutation("ResubmitContentDraft", async ({ variables }) => {
        seen.push(variables);
        return HttpResponse.json({
          data: {
            resubmitContentDraft: {
              ...buildRejectedDraft(),
              status: "PENDING",
              title: (variables as { input: { title: string } }).input.title,
              rejectionNote: null,
            },
          },
        });
      }),
    );
    renderResubmitPage();

    const titleInput = await screen.findByLabelText(/Public title/);
    fireEvent.change(titleInput, {
      target: { value: "Rejected draft title, fixed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Resubmit for review" }));

    await waitFor(() => expect(seen).toHaveLength(1));
    const input = (seen[0] as { input: Record<string, unknown> }).input;
    expect(input.title).toBe("Rejected draft title, fixed");
    expect(input.body).toBe("<p>rejected body</p>");
    expect(input.imageUrl).toBe("https://cdn/cover.png");
    expect(input.postId).toBe("post-9");
    expect(await screen.findByText("draft-detail-page")).toBeInTheDocument();
  });

  it("refuses to edit drafts that are not own rejected ones", async () => {
    setupHandlers([buildRejectedDraft({ status: "PENDING", rejectionNote: null })]);
    renderResubmitPage();

    expect(await screen.findByText("Cannot edit")).toBeInTheDocument();
  });
});
