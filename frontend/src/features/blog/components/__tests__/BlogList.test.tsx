import { HttpResponse, graphql } from "msw";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render-with-providers";
import { server } from "@/test/server";
import { BlogList } from "../BlogList";

const graphqlApi = graphql.link("http://localhost:4000/graphql");

const buildPost = () => ({
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
});

describe("BlogList", () => {
  it("shows the homepage label and loading skeletons before posts resolve", async () => {
    server.use(
      graphqlApi.query("Posts", async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));

        return HttpResponse.json({
          data: {
            posts: {
              __typename: "PaginatedPosts",
              posts: [buildPost()],
              totalPages: 1,
              currentPage: 1,
              totalPosts: 1,
            },
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
});
