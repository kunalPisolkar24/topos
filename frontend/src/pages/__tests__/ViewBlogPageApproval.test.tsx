import { HttpResponse, graphql } from "msw";
import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders } from "@/test/render-with-providers";
import { server } from "@/test/server";
import { sessionStoreActions } from "@/entities/session";
import ViewBlogPage from "../ViewBlogPage";

const graphqlApi = graphql.link("http://localhost:4000/graphql");

const postAuthor = {
  __typename: "User",
  id: "author-9",
  username: "postauthor",
  email: null,
  name: "Post Author",
  bio: "Author bio.",
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

const buildPost = (overrides: Record<string, unknown> = {}) => ({
  __typename: "Post",
  id: "post-1",
  title: "Reviewed article",
  body: "<p>body</p>",
  slug: "reviewed-article",
  imageUrl: null,
  summary: "A summary",
  summaryStatus: "COMPLETED",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  likedByMe: false,
  savedByMe: false,
  author: postAuthor,
  approvedById: reviewerUser.id,
  tags: [],
  related: [],
  ...overrides,
});

const setupPostHandlers = (post: Record<string, unknown>) => {
  server.use(
    graphqlApi.query("Me", () =>
      HttpResponse.json({
        data: {
          me: {
            __typename: "User",
            id: "me-1",
            username: "meuser",
            email: "me@topos.dev",
            name: "Me User",
            bio: null,
            avatarUrl: null,
            bannerUrl: null,
            createdAt: new Date().toISOString(),
          },
        },
      }),
    ),
    graphqlApi.query("Post", () =>
      HttpResponse.json({ data: { post } }),
    ),
    graphqlApi.query("User", async ({ variables }) => {
      const id = (variables as { id?: string })?.id;
      return HttpResponse.json({
        data: { user: id === reviewerUser.id ? reviewerUser : null },
      });
    }),
  );
};

const renderPage = () =>
  renderWithProviders(
    <Routes>
      <Route path="/blog/:id" element={<ViewBlogPage />} />
    </Routes>,
    { route: "/blog/post-1" },
  );

describe("ViewBlogPage approver credit", () => {
  beforeEach(() => {
    sessionStoreActions.markAuthenticated("test-token");
  });

  it("shows who approved the post", async () => {
    setupPostHandlers(buildPost());
    renderPage();

    expect(await screen.findByText("Reviewed article")).toBeInTheDocument();
    expect(await screen.findByText(/Peer Reviewer/)).toBeInTheDocument();
    expect(screen.getByText(/Approved \/\/ Peer review/)).toBeInTheDocument();
  });

  it("hides the approver card for unattributed posts", async () => {
    setupPostHandlers(buildPost({ approvedById: null }));
    renderPage();

    expect(await screen.findByText("Reviewed article")).toBeInTheDocument();
    expect(screen.queryByText(/Approved \/\/ Peer review/)).not.toBeInTheDocument();
  });
});
