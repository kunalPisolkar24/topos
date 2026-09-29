import { HttpResponse, graphql } from "msw";
import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders } from "@/test/render-with-providers";
import { server } from "@/test/server";
import { sessionStoreActions } from "@/entities/session";
import { DraftDetail } from "../DraftDetail";

const graphqlApi = graphql.link("http://localhost:4000/graphql");

const draftAuthor = {
  __typename: "User",
  id: "author-9",
  username: "draftauthor",
  name: "Draft Author",
  avatarUrl: null,
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

const buildDetailDraft = (overrides: Record<string, unknown> = {}) => ({
  __typename: "PostDraft",
  id: "d1",
  approvalId: "ap-1",
  prompt: "write about go",
  title: "Detail draft title",
  body: "<p>body</p>",
  summary: "A summary",
  tags: ["go"],
  imageUrl: "https://cdn/cover.png",
  status: "PENDING",
  author: draftAuthor,
  authorId: "author-9",
  postId: null,
  reviewedById: null,
  reviewedAt: null,
  rejectionNote: null,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  ...overrides,
});

const setupDetailHandlers = (draft: Record<string, unknown>) => {
  server.use(
    graphqlApi.query("Me", () =>
      HttpResponse.json({ data: { me: meUser } }),
    ),
    graphqlApi.query("PostDrafts", () =>
      HttpResponse.json({
        data: {
          postDrafts: {
            __typename: "PaginatedPostDrafts",
            drafts: [draft],
            totalPages: 1,
            currentPage: 1,
            totalDrafts: 1,
          },
        },
      }),
    ),
    graphqlApi.query("MyPostDrafts", () =>
      HttpResponse.json({
        data: {
          myPostDrafts: {
            __typename: "PaginatedPostDrafts",
            drafts: [],
            totalPages: 1,
            currentPage: 1,
            totalDrafts: 0,
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

const renderDetail = () =>
  renderWithProviders(
    <Routes>
      <Route path="/review/:draftId" element={<DraftDetail />} />
    </Routes>,
    { route: "/review/d1" },
  );

describe("DraftDetail identity surfaces", () => {
  beforeEach(() => {
    sessionStoreActions.markAuthenticated("test-token");
  });

  it("shows the author name instead of a raw id", async () => {
    setupDetailHandlers(buildDetailDraft());
    renderDetail();

    expect(await screen.findByText("Detail draft title")).toBeInTheDocument();
    expect(screen.getAllByText(/Draft Author/)).toHaveLength(2);
    expect(screen.queryByText(/author-9/)).not.toBeInTheDocument();
  });

  it("shows the rejection note with the reviewer name", async () => {
    setupDetailHandlers(
      buildDetailDraft({
        status: "REJECTED",
        reviewedById: reviewerUser.id,
        reviewedAt: "2024-02-01T00:00:00.000Z",
        rejectionNote: "Needs a stronger intro",
      }),
    );
    renderDetail();

    expect(await screen.findByText("Needs a stronger intro")).toBeInTheDocument();
    expect(await screen.findByText(/Peer Reviewer/)).toBeInTheDocument();
  });

  it("shows who approved the draft", async () => {
    setupDetailHandlers(
      buildDetailDraft({
        status: "APPROVED",
        reviewedById: reviewerUser.id,
        reviewedAt: "2024-02-01T00:00:00.000Z",
      }),
    );
    renderDetail();

    expect(await screen.findByText(/Peer Reviewer/)).toBeInTheDocument();
    expect(screen.getByText(/Approved \/\/ Peer review/)).toBeInTheDocument();
  });
});
