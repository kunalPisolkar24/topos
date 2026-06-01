import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Command, CommandList } from "@/components/ui/command";
import { renderWithProviders } from "@/test/render-with-providers";
import { SearchBar } from "./SearchBar";
import { PostSuggestions } from "./PostSuggestions";
import { TagSuggestions } from "./TagSuggestions";
import { useSearchSuggestionsController } from "../suggestions";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../suggestions", async () => {
  const actual = await vi.importActual<typeof import("../suggestions")>(
    "../suggestions",
  );

  return {
    ...actual,
    useSearchSuggestionsController: vi.fn(),
  };
});

class ResizeObserverMock {
  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();
}

const tagSuggestions = [
  { id: "tag-1", name: "train1" },
  { id: "tag-2", name: "train2" },
  { id: "tag-3", name: "trains" },
];

const postSuggestions = [
  {
    id: "post-1",
    title: "Riding the Rails of the 19th Century",
    imageUrl: "https://example.com/train-1.jpg",
    authorName: "Ramu22",
  },
  {
    id: "post-2",
    title: "Reviving the Heart of Steam Engines",
    imageUrl: "https://example.com/train-2.jpg",
    authorName: "Ramu22",
  },
];

describe("SearchBar", () => {
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
  const mockUseSearchSuggestions = vi.mocked(useSearchSuggestionsController);

  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  beforeEach(() => {
    mockNavigate.mockReset();
    mockUseSearchSuggestions.mockImplementation(
      ({ query, mode, isFocused, postLimit }) => {
        if (!isFocused || query.trim() === "") {
          return {
            tags: [],
            posts: [],
            totalPosts: 0,
            isLoading: false,
            debouncedQuery: query,
          };
        }

        if (mode === "tags") {
          return {
            tags: tagSuggestions,
            posts: [],
            totalPosts: 0,
            isLoading: false,
            debouncedQuery: query,
          };
        }

        return {
          tags: [],
          posts: postSuggestions.slice(0, postLimit ?? postSuggestions.length),
          totalPosts: postSuggestions.length,
          isLoading: false,
          debouncedQuery: query,
        };
      },
    );
  });

  it("does not auto-highlight the first suggestion when tag results appear", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <SearchBar onTagSelect={vi.fn()} currentFilterTag={null} />,
    );

    const input = screen.getByPlaceholderText(/search tags/i);

    await user.click(input);
    await user.type(input, "train");

    expect(screen.getByText("#TRAIN1")).toBeInTheDocument();
    expect(screen.queryByRole("option", { selected: true })).not.toBeInTheDocument();
  });

  it("highlights only hovered tag suggestions and clears pointer selection on leave", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <SearchBar onTagSelect={vi.fn()} currentFilterTag={null} />,
    );

    const input = screen.getByPlaceholderText(/search tags/i);

    await user.click(input);
    await user.type(input, "train");

    const firstTagSuggestion = screen
      .getByText("#TRAIN1")
      .closest('[data-slot="command-item"]');
    const commandList = screen.getByRole("listbox");

    expect(firstTagSuggestion).not.toBeNull();

    fireEvent.pointerMove(firstTagSuggestion as HTMLElement);
    expect(firstTagSuggestion).toHaveAttribute("data-selected", "true");

    fireEvent.pointerLeave(commandList);
    expect(screen.queryByRole("option", { selected: true })).not.toBeInTheDocument();
  });

  it("shows keyboard selection only after navigation and uses Enter on the active post", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <SearchBar onTagSelect={vi.fn()} currentFilterTag={null} />,
    );

    await user.click(screen.getByRole("button", { name: /posts/i }));

    const input = screen.getByPlaceholderText(/search post titles & content/i);

    await user.click(input);
    await user.type(input, "train");

    expect(screen.queryByRole("option", { selected: true })).not.toBeInTheDocument();

    await user.keyboard("{ArrowDown}");

    const firstPostSuggestion = screen
      .getByText("Riding the Rails of the 19th Century")
      .closest('[data-slot="command-item"]');

    expect(firstPostSuggestion).toHaveAttribute("data-selected", "true");

    await user.keyboard("{Enter}");

    expect(mockNavigate).toHaveBeenCalledWith("/blog/post-1");
  });

  it("clears selection when the query changes and when the mode switches", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <SearchBar onTagSelect={vi.fn()} currentFilterTag={null} />,
    );

    const input = screen.getByPlaceholderText(/search tags/i);

    await user.click(input);
    await user.type(input, "train");

    const firstTagSuggestion = screen
      .getByText("#TRAIN1")
      .closest('[data-slot="command-item"]');

    fireEvent.pointerMove(firstTagSuggestion as HTMLElement);
    expect(firstTagSuggestion).toHaveAttribute("data-selected", "true");

    await user.type(input, "s");
    expect(screen.queryByRole("option", { selected: true })).not.toBeInTheDocument();

    fireEvent.pointerMove(
      screen.getByText("#TRAIN1").closest('[data-slot="command-item"]') as HTMLElement,
    );
    expect(screen.getByRole("option", { selected: true })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /posts/i }));

    expect(screen.getByText("Post Suggestions")).toBeInTheDocument();
    expect(screen.queryByRole("option", { selected: true })).not.toBeInTheDocument();
  });

  it("applies the tightened heading and tag label styling without trailing row margins", () => {
    renderWithProviders(
      <Command shouldFilter={false}>
        <CommandList>
          <TagSuggestions
            tags={tagSuggestions as never[]}
            onSelect={vi.fn()}
          />
        </CommandList>
      </Command>,
    );

    const tagGroup = screen.getByText("Tag Suggestions").closest("[cmdk-group]");
    const firstTagSuggestion = screen
      .getByText("#TRAIN1")
      .closest('[data-slot="command-item"]');

    expect(tagGroup).toHaveClass(
      "p-0",
      "[&_[cmdk-group-heading]]:text-[0.75rem]",
      "[&_[cmdk-group-heading]]:tracking-[0.18em]",
      "[&_[cmdk-group-items]]:space-y-1",
    );
    expect(firstTagSuggestion).not.toHaveClass("mb-1.5");
    expect(screen.getByText("#TRAIN1")).toHaveClass(
      "text-[0.8125rem]",
      "tracking-[0.18em]",
    );
  });

  it("applies the denser post row styling without trailing row margins", () => {
    renderWithProviders(
      <Command shouldFilter={false}>
        <CommandList>
          <PostSuggestions
            posts={postSuggestions}
            totalPosts={postSuggestions.length}
            limit={postSuggestions.length}
            onSelect={vi.fn()}
            onSeeAll={vi.fn()}
          />
        </CommandList>
      </Command>,
    );

    const postGroup = screen.getByText("Post Suggestions").closest("[cmdk-group]");
    const firstPostSuggestion = screen
      .getByText("Riding the Rails of the 19th Century")
      .closest('[data-slot="command-item"]');

    expect(postGroup).toHaveClass(
      "p-0",
      "[&_[cmdk-group-heading]]:text-[0.75rem]",
      "[&_[cmdk-group-heading]]:tracking-[0.18em]",
      "[&_[cmdk-group-items]]:space-y-1",
    );
    expect(firstPostSuggestion).not.toHaveClass("mb-1.5");
    expect(
      screen.getByText("Riding the Rails of the 19th Century"),
    ).toHaveClass("text-[0.97rem]");
  });
});
