import { HttpResponse, graphql } from "msw";
import { screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders } from "@/test/render-with-providers";
import { server } from "@/test/server";
import { sessionStoreActions } from "@/entities/session";
import SearchResultsPage from "../SearchResultsPage";

const graphqlApi = graphql.link("http://localhost:4000/graphql");

const buildHit = (overrides: Record<string, unknown> = {}) => ({
  __typename: "Post" as const,
  id: "search-hit-1",
  title: "Search Result Title",
  body: "<p>Matching content snippet</p>",
  imageUrl: "https://images.example.com/search-hit.jpg",
  createdAt: "2024-01-15T12:00:00.000Z",
  author: {
    __typename: "User" as const,
    id: "author-1",
    username: "searchauthor",
    name: "Search Author",
    avatarUrl: null,
  },
  tags: [],
  ...overrides,
});

describe("SearchResultsPage - integration", () => {
  beforeEach(() => {
    sessionStoreActions.markAnonymous();
  });

  it("shows search results from the API", async () => {
    server.use(
      graphqlApi.query("SearchPosts", () =>
        HttpResponse.json({
          data: {
            searchPosts: {
              __typename: "SearchResult",
              hits: [buildHit()],
              total: 1,
            },
          },
        }),
      ),
    );

    renderWithProviders(
      <Routes>
        <Route path="/search" element={<SearchResultsPage />} />
      </Routes>,
      { route: "/search?q=test+query" },
    );

    expect(
      await screen.findByText(/search results for/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 posts found/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /open blog post: search result title/i }),
    ).toBeInTheDocument();
  });

  it("shows empty state when no results match", async () => {
    server.use(
      graphqlApi.query("SearchPosts", () =>
        HttpResponse.json({
          data: {
            searchPosts: {
              __typename: "SearchResult",
              hits: [],
              total: 0,
            },
          },
        }),
      ),
    );

    renderWithProviders(
      <Routes>
        <Route path="/search" element={<SearchResultsPage />} />
      </Routes>,
      { route: "/search?q=nonexistent" },
    );

    await waitFor(() => {
      expect(
        screen.getByText("No posts found matching your query."),
      ).toBeInTheDocument();
    });
  });

  it("shows loading state while the search is in flight", async () => {
    server.use(
      graphqlApi.query("SearchPosts", async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
        return HttpResponse.json({
          data: {
            searchPosts: {
              __typename: "SearchResult",
              hits: [buildHit()],
              total: 1,
            },
          },
        });
      }),
    );

    const { container } = renderWithProviders(
      <Routes>
        <Route path="/search" element={<SearchResultsPage />} />
      </Routes>,
      { route: "/search?q=delayed" },
    );

    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length,
    ).toBeGreaterThan(0);

    expect(
      await screen.findByRole("link", { name: /open blog post: search result title/i }),
    ).toBeInTheDocument();
  });

  it("redirects to home when no query is provided", async () => {
    renderWithProviders(
      <Routes>
        <Route path="/search" element={<SearchResultsPage />} />
        <Route path="/" element={<div>Home Page</div>} />
      </Routes>,
      { route: "/search" },
    );

    await waitFor(() => {
      expect(screen.getByText("Home Page")).toBeInTheDocument();
    });
  });
});
