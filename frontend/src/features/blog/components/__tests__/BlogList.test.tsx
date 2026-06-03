import { HttpResponse, graphql } from "msw";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/render-with-providers";
import { server } from "@/test/server";
import { BlogList } from "../BlogList";

const graphqlApi = graphql.link("http://localhost:4000/graphql");

const buildPost = (overrides: Record<string, unknown> = {}) => ({
  __typename: "Post" as const,
  id: "post-1",
  title: "Optimizing Neural Network Throughput for Low-Latency Architectures",
  body: "<p>Kernel-level optimizations for inference workloads.</p>",
  imageUrl: "https://images.example.com/post-1.jpg",
  createdAt: "2023-10-24T12:00:00.000Z",
  author: {
    __typename: "User" as const,
    id: "author-1",
    username: "marcusthorne",
    name: "Marcus Thorne",
    avatarUrl: null,
  },
  tags: [
    {
      __typename: "Tag" as const,
      id: "tag-1",
      name: "Architecture",
    },
  ],
  ...overrides,
});

const buildPostsResponse = (posts: unknown[] = [buildPost()], totalPosts = 1) => ({
  __typename: "PaginatedPosts",
  posts,
  totalPages: Math.ceil(totalPosts / 6),
  currentPage: 1,
  totalPosts,
});

describe("BlogList", () => {
  it("shows the homepage label and loading skeletons before posts resolve", async () => {
    server.use(
      graphqlApi.query("Posts", async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));

        return HttpResponse.json({
          data: {
            posts: buildPostsResponse(),
          },
        });
      }),
    );

    const { container } = renderWithProviders(<BlogList />);

    expect(screen.getByText("LATEST UPDATES")).toBeInTheDocument();
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length,
    ).toBeGreaterThan(0);
    expect(
      await screen.findByRole("link", {
        name: /open blog post: optimizing neural network throughput/i,
      }),
    ).toBeInTheDocument();
  });

  it("renders posts filtered by tag", async () => {
    server.use(
      graphqlApi.query("PostsByTag", () =>
        HttpResponse.json({
          data: {
            postsByTag: buildPostsResponse([buildPost({ id: "tagged-post" })]),
          },
        }),
      ),
    );

    renderWithProviders(<BlogList filterTag="Architecture" />);

    expect(
      await screen.findByRole("link", {
        name: /open blog post: optimizing neural network throughput/i,
      }),
    ).toBeInTheDocument();
  });

  it("shows empty state when no posts exist", async () => {
    server.use(
      graphqlApi.query("Posts", () =>
        HttpResponse.json({
          data: { posts: buildPostsResponse([], 0) },
        }),
      ),
    );

    renderWithProviders(<BlogList />);

    expect(
      await screen.findByText("No blog posts available yet."),
    ).toBeInTheDocument();
  });

  it("shows tag-specific message when no posts match the filter", async () => {
    server.use(
      graphqlApi.query("PostsByTag", () =>
        HttpResponse.json({
          data: {
            postsByTag: buildPostsResponse([], 0),
          },
        }),
      ),
    );

    renderWithProviders(<BlogList filterTag="UnknownTag" />);

    expect(
      await screen.findByText(/no posts found for the tag/i),
    ).toBeInTheDocument();
  });

  it("shows empty state when post query fails", async () => {
    server.use(
      graphqlApi.query("Posts", () =>
        HttpResponse.json({ errors: [{ message: "Server error" }] }),
      ),
    );

    renderWithProviders(<BlogList />);

    await waitFor(() => {
      expect(screen.getByText("No blog posts available yet.")).toBeInTheDocument();
    });
  });
});
