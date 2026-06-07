import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApolloProvider } from "@apollo/client/react";
import { MemoryRouter } from "react-router-dom";
import { HttpResponse, graphql } from "msw";
import { createApolloClient } from "@/shared/api";
import { env } from "@/shared/config/env";
import { server } from "@/test/server";
import { useUserPostsController } from "../useUserPostsController";

const noopUnauthorized = async () => {};

const graphqlApi = graphql.link("http://localhost:4000/graphql");

describe("useUserPostsController", () => {
  it("returns empty blogs when userId is not provided", () => {
    const client = createApolloClient({
      uri: env.VITE_GRAPHQL_URL,
      getToken: () => null,
      onUnauthorized: noopUnauthorized,
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ApolloProvider client={client}>
        <MemoryRouter>{children}</MemoryRouter>
      </ApolloProvider>
    );

    const { result } = renderHook(
      () => useUserPostsController({ userId: undefined }),
      { wrapper },
    );

    expect(result.current.state.blogs).toEqual([]);
    expect(result.current.state.totalPosts).toBe(0);
  });

  it("fetches posts when userId is provided", async () => {
    server.use(
      graphqlApi.query("MyPosts", () =>
        HttpResponse.json({
          data: {
            me: {
              __typename: "User",
              id: "user-1",
              posts: {
                __typename: "PaginatedPosts",
                posts: [
                  {
                    __typename: "Post",
                    id: "post-1",
                    title: "Test Post",
                    body: "<p>body</p>",
                    imageUrl: null,
                    createdAt: "2024-01-01T00:00:00Z",
                    author: {
                      __typename: "User",
                      id: "author-1",
                      username: "author",
                      name: "Author",
                      avatarUrl: null,
                    },
                    tags: [],
                  },
                ],
                totalPages: 1,
                currentPage: 1,
                totalPosts: 1,
              },
            },
          },
        }),
      ),
    );

    const client = createApolloClient({
      uri: env.VITE_GRAPHQL_URL,
      getToken: () => null,
      onUnauthorized: noopUnauthorized,
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ApolloProvider client={client}>
        <MemoryRouter>{children}</MemoryRouter>
      </ApolloProvider>
    );

    const { result } = renderHook(
      () => useUserPostsController({ userId: "user-1" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.state.blogs).toHaveLength(1);
    });
    expect(result.current.state.totalPosts).toBe(1);
  });

  it("ignores page change when page is out of range", () => {
    const client = createApolloClient({
      uri: env.VITE_GRAPHQL_URL,
      getToken: () => null,
      onUnauthorized: noopUnauthorized,
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ApolloProvider client={client}>
        <MemoryRouter>{children}</MemoryRouter>
      </ApolloProvider>
    );

    const { result } = renderHook(
      () => useUserPostsController({ userId: undefined }),
      { wrapper },
    );

    result.current.handlePageChange(0);
    expect(result.current.state.currentPage).toBe(1);

    result.current.handlePageChange(2);
    expect(result.current.state.currentPage).toBe(1);
  });
});
