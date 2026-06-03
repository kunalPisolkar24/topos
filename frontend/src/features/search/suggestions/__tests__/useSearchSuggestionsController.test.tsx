import { renderHook, waitFor } from "@testing-library/react";

const searchTagsOnceMock = vi.fn();

const mockApolloClient = { query: vi.fn() };

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
});
