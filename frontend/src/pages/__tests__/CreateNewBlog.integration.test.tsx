import { forwardRef } from "react";
import { HttpResponse, graphql } from "msw";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders } from "@/test/render-with-providers";
import { server } from "@/test/server";
import { sessionStoreActions } from "@/entities/session";
import CreateNewBlog from "../CreateNewBlog";

vi.mock("react-quill-new", () => {
  const ReactQuillMock = forwardRef<
    HTMLDivElement,
    { onChange?: (value: string) => void }
  >(({ onChange }, ref) => (
    <div
      data-testid="react-quill-mock"
      ref={(node) => {
        if (typeof ref === "function") {
          ref(node as unknown as Parameters<NonNullable<typeof ref>>[0]);
        } else if (ref && typeof ref === "object") {
          (ref as { current: HTMLDivElement | null }).current = node;
        }
      }}
    >
      <textarea
        data-testid="react-quill-textarea"
        onChange={(event) => onChange?.(event.target.value)}
      />
    </div>
  ));
  ReactQuillMock.displayName = "ReactQuill";
  return { default: ReactQuillMock };
});

vi.mock("@/entities/upload", () => ({
  useImageUpload: () => ({
    upload: vi.fn().mockResolvedValue(
      "https://res.cloudinary.com/topos/test-image.jpg",
    ),
    isUploading: false,
  }),
  resetDefaultImageUploadProviderForTests: vi.fn(),
}));

class ResizeObserverMock {
  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();
}

const graphqlApi = graphql.link("http://localhost:4000/graphql");

describe("CreateNewBlog - integration", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    sessionStoreActions.markAuthenticated("test-token");
  });

  it("renders the creation form with all sections", async () => {
    server.use(
      graphqlApi.query("Me", () =>
        HttpResponse.json({
          data: {
            me: {
              __typename: "User",
              id: "author-1",
              username: "testauthor",
              email: "test@example.com",
              name: "Test Author",
              bio: null,
              avatarUrl: null,
              bannerUrl: null,
              createdAt: "2024-01-01T00:00:00Z",
            },
          },
        }),
      ),
    );

    renderWithProviders(
      <Routes>
        <Route path="/create-blog" element={<CreateNewBlog />} />
      </Routes>,
      { route: "/create-blog" },
    );

    expect(
      await screen.findByText("Compose a precise Topos post."),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/write a clear, specific headline/i),
    ).toBeInTheDocument();
    expect(screen.getByText("01 // Title")).toBeInTheDocument();
    expect(screen.getByText("02 // Assisted Draft")).toBeInTheDocument();
    expect(screen.getByText("03 // Cover Asset")).toBeInTheDocument();
    expect(screen.getByText("04 // Body")).toBeInTheDocument();
    expect(screen.getByText("05 // Metadata")).toBeInTheDocument();
    expect(screen.getByText("Publish Stack")).toBeInTheDocument();
  });

  it("stays on the create form when submitting with empty fields", async () => {
    const user = userEvent.setup();

    server.use(
      graphqlApi.query("Me", () =>
        HttpResponse.json({
          data: {
            me: {
              __typename: "User",
              id: "author-1",
              username: "testauthor",
              email: "test@example.com",
              name: "Test Author",
              bio: null,
              avatarUrl: null,
              bannerUrl: null,
              createdAt: "2024-01-01T00:00:00Z",
            },
          },
        }),
      ),
    );

    renderWithProviders(
      <Routes>
        <Route path="/create-blog" element={<CreateNewBlog />} />
        <Route path="/" element={<div>Home Page</div>} />
      </Routes>,
      { route: "/create-blog" },
    );

    await screen.findByText("Compose a precise Topos post.");

    await user.click(screen.getByRole("button", { name: /publish post/i }));

    expect(
      screen.getByText("Compose a precise Topos post."),
    ).toBeInTheDocument();
  });

  it("cancels creation and navigates to the home page", async () => {
    const user = userEvent.setup();

    server.use(
      graphqlApi.query("Me", () =>
        HttpResponse.json({
          data: {
            me: {
              __typename: "User",
              id: "author-1",
              username: "testauthor",
              email: "test@example.com",
              name: "Test Author",
              bio: null,
              avatarUrl: null,
              bannerUrl: null,
              createdAt: "2024-01-01T00:00:00Z",
            },
          },
        }),
      ),
    );

    renderWithProviders(
      <Routes>
        <Route path="/create-blog" element={<CreateNewBlog />} />
        <Route path="/" element={<div>Home Page</div>} />
      </Routes>,
      { route: "/create-blog" },
    );

    await screen.findByText("Compose a precise Topos post.");

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.getByText("Home Page")).toBeInTheDocument();
    });
  });

  it("adds a tag successfully", async () => {
    const user = userEvent.setup();

    server.use(
      graphqlApi.query("Me", () =>
        HttpResponse.json({
          data: {
            me: {
              __typename: "User",
              id: "author-1",
              username: "testauthor",
              email: "test@example.com",
              name: "Test Author",
              bio: null,
              avatarUrl: null,
              bannerUrl: null,
              createdAt: "2024-01-01T00:00:00Z",
            },
          },
        }),
      ),
    );

    renderWithProviders(
      <Routes>
        <Route path="/create-blog" element={<CreateNewBlog />} />
      </Routes>,
      { route: "/create-blog" },
    );

    await screen.findByText("Compose a precise Topos post.");

    await user.click(screen.getByRole("button", { name: /add tags/i }));

    const tagInput = screen.getByPlaceholderText("Enter tag name");
    await user.type(tagInput, "Architecture");

    await user.click(screen.getByRole("button", { name: /^add tag$/i }));

    expect(screen.getByText("Architecture")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remove architecture tag/i })).toBeInTheDocument();
  });

  it("creates a new post successfully and redirects to home", async () => {
    const user = userEvent.setup();

    server.use(
      graphqlApi.query("Me", () =>
        HttpResponse.json({
          data: {
            me: {
              __typename: "User",
              id: "author-1",
              username: "testauthor",
              email: "test@example.com",
              name: "Test Author",
              bio: null,
              avatarUrl: null,
              bannerUrl: null,
              createdAt: "2024-01-01T00:00:00Z",
            },
          },
        }),
      ),
      graphqlApi.mutation("CreatePost", () =>
        HttpResponse.json({
          data: {
            createPost: {
              __typename: "Post",
              id: "new-post-1",
            },
          },
        }),
      ),
    );

    renderWithProviders(
      <Routes>
        <Route path="/create-blog" element={<CreateNewBlog />} />
        <Route path="/" element={<div>Home Page After Create</div>} />
      </Routes>,
      { route: "/create-blog" },
    );

    await screen.findByText("Compose a precise Topos post.");

    const titleInput = screen.getByPlaceholderText(/write a clear, specific headline/i);
    await user.type(titleInput, "My New Blog Post");

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();
    const file = new File(["dummy"], "test-image.png", { type: "image/png" });
    fireEvent.change(fileInput!, { target: { files: [file] } });

    const quillTextarea = screen.getByTestId("react-quill-textarea");
    fireEvent.change(quillTextarea, { target: { value: "<p>Blog content</p>" } });

    await user.click(screen.getByRole("button", { name: /add tags/i }));
    const tagInput = screen.getByPlaceholderText("Enter tag name");
    await user.type(tagInput, "Architecture");
    await user.click(screen.getByRole("button", { name: /^add tag$/i }));

    await user.click(screen.getByRole("button", { name: /publish post/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Home Page After Create"),
      ).toBeInTheDocument();
    });
  });
});
