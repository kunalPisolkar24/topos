import { renderHook, waitFor } from "@testing-library/react";
import { ApolloProvider } from "@apollo/client/react";
import { createApolloClient } from "@/shared/api";
import { env } from "@/shared/config/env";
import type { ReactNode } from "react";

const searchTagsOnceMock = vi.fn();
const searchOnceMock = vi.fn();

vi.mock("@/entities/tag/api/tagRepository", () => ({
  tagRepository: {
    searchTagsOnce: (...args: unknown[]) => searchTagsOnceMock(...args),
    useSearch: vi.fn(),
  },
}));

vi.mock("@/entities/post/api/postRepository", () => ({
  postRepository: {
    searchOnce: (...args: unknown[]) => searchOnceMock(...args),
  },
}));

import { useSearchSuggestionsController } from "../useSearchSuggestionsController";

const noopUnauthorized = async () => {};

function makeWrapper() {
  const client = createApolloClient({
    uri: env.VITE_GRAPHQL_URL,
    getToken: () => null,
    onUnauthorized: noopUnauthorized,
  });
  return ({ children }: { children: ReactNode }) => (
    <ApolloProvider client={client}>{children}</ApolloProvider>
  );
}

function renderSuggestions(
  props?: Partial<Parameters<typeof useSearchSuggestionsController>[0]>,
) {
  return renderHook(
    () =>
      useSearchSuggestionsController({
        query: "test",
        mode: "tags",
        isFocused: true,
        ...props,
      }),
    { wrapper: makeWrapper() },
  );
}

describe("useSearchSuggestionsController", () => {
  beforeEach(() => {
    searchTagsOnceMock.mockReset();
    searchOnceMock.mockReset();
  });

  it("returns empty results when not focused", async () => {
    searchTagsOnceMock.mockResolvedValue([]);
    const { result } = renderSuggestions({ isFocused: false });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.tags).toEqual([]);
  });

  it("fetches tags after debounce", async () => {
    searchTagsOnceMock.mockResolvedValue([{ id: "1", name: "React" }]);
    const { result } = renderSuggestions({ query: "react" });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(searchTagsOnceMock).toHaveBeenCalled();
    expect(result.current.tags).toHaveLength(1);
  });

  it("clears results when query is empty", async () => {
    const { result } = renderSuggestions({ query: "" });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.tags).toEqual([]);
  });

  it("fetches posts in posts mode", async () => {
    searchOnceMock.mockResolvedValue({
      data: {
        searchPosts: {
          hits: [
            {
              id: "post-1",
              title: "Test Post",
              imageUrl: null,
              author: { name: "Author", username: "author" },
            },
          ],
          total: 1,
        },
      },
    });
    const { result } = renderSuggestions({ query: "react", mode: "posts" });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.posts).toHaveLength(1);
    expect(result.current.totalPosts).toBe(1);
    expect(result.current.tags).toEqual([]);
  });

  it("handles tag search error gracefully", async () => {
    searchTagsOnceMock.mockRejectedValue(new Error("Network error"));
    const { result } = renderSuggestions({ query: "react", mode: "tags" });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.tags).toEqual([]);
    expect(result.current.posts).toEqual([]);
  });

  it("handles posts search error gracefully", async () => {
    searchOnceMock.mockRejectedValue(new Error("Network error"));
    const { result } = renderSuggestions({ query: "react", mode: "posts" });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.tags).toEqual([]);
    expect(result.current.posts).toEqual([]);
  });

  it("handles posts response with missing hits", async () => {
    searchOnceMock.mockResolvedValue({
      data: {
        searchPosts: { total: 0 },
      },
    });
    const { result } = renderSuggestions({ query: "react", mode: "posts" });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.posts).toEqual([]);
    expect(result.current.totalPosts).toBe(0);
  });

  it("returns empty posts when posts mode returns no hits", async () => {
    searchOnceMock.mockResolvedValue({});
    const { result } = renderSuggestions({ query: "react", mode: "posts" });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.posts).toEqual([]);
  });
});
