import { HttpResponse, graphql } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render-with-providers";
import { server } from "@/test/server";
import { sessionStoreActions } from "@/entities/session";
import { previewDB } from "@/mocks/preview/preview-db";
import type { MockDraft, MockUser } from "@/mocks/data";
import type { PostDraft } from "@/shared/graphql/content-documents";
import ReviewQueuePage from "../ReviewQueuePage";

const previewState = { enabled: false };

vi.mock("@/shared/config/preview", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/config/preview")>();
  return { ...actual, isPreview: () => previewState.enabled };
});

const graphqlApi = graphql.link("http://localhost:4000/graphql");

const buildDraft = (overrides: Partial<PostDraft> = {}): PostDraft => {
  const { author, authorId = "author-9", ...rest } = overrides;
  return {
    __typename: "PostDraft",
    id: "draft-community-1",
    approvalId: "ap-1",
    prompt: "write about go",
    title: "Community draft title",
    body: "<p>body</p>",
    summary: "A summary",
    tags: ["go"],
    status: "PENDING",
    author: author ?? {
      __typename: "User",
      id: authorId,
      username: "draftauthor",
      name: "Draft Author",
      avatarUrl: null,
    },
    authorId,
    postId: null,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...rest,
  };
};

const buildUser = (id: string): MockUser => ({
  id,
  username: `reviewer-${id}`,
  email: `${id}@topos.dev`,
  name: `Reviewer ${id}`,
  bio: "Preview reviewer.",
  avatarUrl: null,
  bannerUrl: null,
  createdAt: "2025-01-01T00:00:00.000Z",
});

const buildPreviewDraft = (overrides: Partial<MockDraft> = {}): MockDraft => ({
  id: `draft-preview-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  approvalId: "approval-x",
  prompt: "preview prompt",
  title: "Reviewed draft title",
  body: "<p>body</p>",
  summary: "Reviewed summary",
  tags: ["go"],
  status: "APPROVED",
  authorId: "author-9",
  postId: null,
  createdAt: "2025-03-02T10:00:00.000Z",
  updatedAt: "2025-03-02T10:00:00.000Z",
  ...overrides,
});

const setupQueueHandlers = (mine: PostDraft[] = []) => {
  server.use(
    graphqlApi.query("PostDrafts", () =>
      HttpResponse.json({
        data: {
          postDrafts: {
            __typename: "PaginatedPostDrafts",
            drafts: [buildDraft()],
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
            drafts: mine,
            totalPages: 1,
            currentPage: 1,
            totalDrafts: mine.length,
          },
        },
      }),
    ),
    graphqlApi.query("Me", () =>
      HttpResponse.json({
        data: {
          me: {
            __typename: "User",
            id: "reviewer-1",
            username: "reviewer-1",
            email: "reviewer-1@topos.dev",
            name: "Reviewer One",
            bio: null,
            avatarUrl: null,
            bannerUrl: null,
            createdAt: new Date().toISOString(),
          },
        },
      }),
    ),
  );
};

describe("ReviewQueuePage tabs", () => {
  beforeEach(() => {
    previewState.enabled = false;
    sessionStoreActions.markAuthenticated("test-token");
    setupQueueHandlers();
  });

  it("shows the needs-review list by default with counts and no history tabs", async () => {
    renderWithProviders(<ReviewQueuePage />, { route: "/review" });

    expect(await screen.findByText("Community draft title")).toBeInTheDocument();
    expect(screen.getByText(/Draft Author/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /needs review/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /your drafts/i })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /approved by you/i })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /needs review/i }).textContent).toContain("(1)");
  });

  it("shows the your-drafts list for ?tab=your-drafts and hides community content", async () => {
    const mineDraft = buildDraft({ id: "draft-mine-1", title: "My draft title", authorId: "reviewer-1" });
    setupQueueHandlers([mineDraft]);

    renderWithProviders(<ReviewQueuePage />, { route: "/review?tab=your-drafts" });

    expect(await screen.findByText("My draft title")).toBeInTheDocument();
    expect(screen.queryByText("Community draft title")).not.toBeInTheDocument();
  });

  it("falls back to needs-review for an unknown tab param", async () => {
    renderWithProviders(<ReviewQueuePage />, { route: "/review?tab=bogus" });

    expect(await screen.findByText("Community draft title")).toBeInTheDocument();
  });

  it("switches lists when tabs are clicked", async () => {
    const user = userEvent.setup();
    const mineDraft = buildDraft({ id: "draft-mine-2", title: "My draft title", authorId: "reviewer-1" });
    setupQueueHandlers([mineDraft]);

    renderWithProviders(<ReviewQueuePage />, { route: "/review" });
    expect(await screen.findByText("Community draft title")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /your drafts/i }));

    expect(await screen.findByText("My draft title")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("Community draft title")).not.toBeInTheDocument(),
    );
  });

  it("refetches the newly active section when switching tabs", async () => {
    const user = userEvent.setup();
    let myDraftsRequests = 0;
    setupQueueHandlers();
    server.use(
      graphqlApi.query("MyPostDrafts", () => {
        myDraftsRequests += 1;
        return HttpResponse.json({
          data: {
            myPostDrafts: {
              __typename: "PaginatedPostDrafts",
              drafts: [],
              totalPages: 1,
              currentPage: 1,
              totalDrafts: 0,
            },
          },
        });
      }),
    );

    renderWithProviders(<ReviewQueuePage />, { route: "/review" });
    expect(await screen.findByText("Community draft title")).toBeInTheDocument();
    await waitFor(() => expect(myDraftsRequests).toBeGreaterThanOrEqual(1));

    const before = myDraftsRequests;
    await user.click(screen.getByRole("tab", { name: /your drafts/i }));

    await waitFor(() => expect(myDraftsRequests).toBeGreaterThan(before));
  });
});

describe("ReviewQueuePage tabs in preview", () => {
  beforeEach(() => {
    previewState.enabled = true;
    sessionStoreActions.markAuthenticated("test-token");
    setupQueueHandlers();
  });

  it("shows history tabs with reviewed drafts", async () => {
    const reviewer = buildUser(`preview-reviewer-${Date.now()}`);
    await previewDB.put("users", reviewer);
    const approved = buildPreviewDraft({
      title: "Approved history draft",
      status: "APPROVED",
      reviewedById: reviewer.id,
      reviewedAt: "2025-03-03T10:00:00.000Z",
    });
    await previewDB.put("drafts", approved);

    server.use(
      graphqlApi.query("Me", () =>
        HttpResponse.json({
          data: {
            me: {
              __typename: "User",
              id: reviewer.id,
              username: reviewer.username,
              email: reviewer.email,
              name: reviewer.name,
              bio: null,
              avatarUrl: null,
              bannerUrl: null,
              createdAt: reviewer.createdAt,
            },
          },
        }),
      ),
    );

    renderWithProviders(<ReviewQueuePage />, { route: "/review?tab=approved" });

    expect(await screen.findByText("Approved history draft")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /approved by you/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /rejected by you/i })).toBeInTheDocument();
  });
});
