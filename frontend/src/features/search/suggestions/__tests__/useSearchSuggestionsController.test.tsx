import { renderHook, waitFor } from "@testing-library/react";

const searchTagsOnceMock = vi.fn();
const searchPostsMock = vi.fn();

const mockApolloClient = { query: searchPostsMock };

vi.mock("@apollo/client/react", () => ({
  useApolloClient: () => mockApolloClient,
}));

vi.mock("@/entities/tag/api/tagRepository", () => ({
  tagRepository: {
    searchTagsOnce: (...args: unknown[]) => searchTagsOnceMock(...args),
    useSearch: vi.fn(),
  },
}));

vi.mock("@/entities/post/lib", () => ({
  DEFAULT_BLOG_CARD_IMAGE: "https://default.png",
  getAuthorDisplayName: (author: { name?: string | null; username: string }) =>
    author.name || author.username,
}));

import { useSearchSuggestionsController } from "../useSearchSuggestionsController";

function renderSuggestions(
  props?: Partial<Parameters<typeof useSearchSuggestionsController>[0]>,
) {
  return renderHook(() =>
    useSearchSuggestionsController({
      query: "test",
      mode: "tags",
      isFocused: true,
      ...props,
    }),
  );
}

describe("useSearchSuggestionsController", () => {
  beforeEach(() => {
    searchTagsOnceMock.mockReset();
    searchPostsMock.mockReset();
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
    searchPostsMock.mockResolvedValue({
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
    searchPostsMock.mockRejectedValue(new Error("Network error"));
    const { result } = renderSuggestions({ query: "react", mode: "posts" });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.tags).toEqual([]);
    expect(result.current.posts).toEqual([]);
  });

  it("handles posts response with missing hits", async () => {
    searchPostsMock.mockResolvedValue({
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
    searchPostsMock.mockResolvedValue({});
    const { result } = renderSuggestions({ query: "react", mode: "posts" });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.posts).toEqual([]);
  });
});
