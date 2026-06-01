import { HttpResponse, graphql } from "msw";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApolloProvider } from "@apollo/client/react";
import { MemoryRouter } from "react-router-dom";
import type { ApolloClient } from "@apollo/client";
import { server } from "@/test/server";
import { createApolloClient } from "@/shared/api";
import { env } from "@/shared/config/env";
import { usePostAuthoringController } from "./usePostAuthoringController";

const noopUnauthorized = async () => {};

function makeWrapper() {
  const clientRef: { current: ApolloClient | null } = { current: null };
  const wrapper = ({ children }: { children: ReactNode }) => {
    if (clientRef.current === null) {
      clientRef.current = createApolloClient({
        uri: env.VITE_GRAPHQL_URL,
        getToken: () => null,
        onUnauthorized: noopUnauthorized,
      });
    }
    return (
      <ApolloProvider client={clientRef.current}>
        <MemoryRouter initialEntries={["/"]}>{children}</MemoryRouter>
      </ApolloProvider>
    );
  };
  return wrapper;
}

describe("usePostAuthoringController", () => {
  const wrapper = makeWrapper();

  it("exposes the create-mode public surface", () => {
    const { result } = renderHook(
      () => usePostAuthoringController({ mode: "create" }),
      { wrapper },
    );

    expect(result.current.state.mode).toBe("create");
    expect(result.current.state.title).toBe("");
    expect(result.current.state.content).toBe("");
    expect(result.current.state.tags).toEqual([]);
    expect(result.current.state.submit).toEqual({ kind: "idle" });
    expect(result.current.state.isSubmitting).toBe(false);
    expect(result.current.state.submitLabel).toBe("Publish Post");
    expect(result.current.state.isCoverImageReady).toBe(false);
    expect(result.current.state.isTitleReady).toBe(false);
    expect(result.current.refs.quillRef.current).toBeNull();
    expect(result.current.refs.cardImageInputRef.current).toBeNull();
  });

  it("seeds the edit-mode state from the provided post", () => {
    const { result } = renderHook(
      () =>
        usePostAuthoringController({
          mode: "edit",
          post: {
            id: "p1",
            title: "Seed Title",
            body: "<p>Seed body</p>",
            imageUrl: "https://x/y.png",
            tags: [
              { id: "t1", name: "alpha" },
              { id: "t2", name: "beta" },
            ],
          },
        }),
      { wrapper },
    );

    expect(result.current.state.mode).toBe("edit");
    expect(result.current.state.title).toBe("Seed Title");
    expect(result.current.state.content).toBe("<p>Seed body</p>");
    expect(result.current.state.cardImageUrl).toBe("https://x/y.png");
    expect(result.current.state.cardImagePreview).toBe("https://x/y.png");
    expect(result.current.state.tags).toEqual(["alpha", "beta"]);
    expect(result.current.state.isCoverImageReady).toBe(true);
    expect(result.current.state.isTitleReady).toBe(true);
    expect(result.current.state.isContentReady).toBe(true);
    expect(result.current.state.submitLabel).toBe("Save Changes");
  });

  it("updates title and content when the consumer changes them", () => {
    const { result } = renderHook(
      () => usePostAuthoringController({ mode: "create" }),
      { wrapper },
    );

    act(() => result.current.setters.setTitle("Hello"));
    act(() => result.current.setters.setContent("<p>world</p>"));

    expect(result.current.state.title).toBe("Hello");
    expect(result.current.state.content).toBe("<p>world</p>");
    expect(result.current.state.contentText).toBe("world");
    expect(result.current.state.isContentReady).toBe(true);
  });

  it("adds and removes tags through the handlers", () => {
    const { result } = renderHook(
      () => usePostAuthoringController({ mode: "create" }),
      { wrapper },
    );

    act(() => result.current.setters.setNewTag("react"));
    act(() => result.current.handlers.handleAddTag());
    expect(result.current.state.tags).toEqual(["react"]);

    act(() => result.current.handlers.handleRemoveTag("react"));
    expect(result.current.state.tags).toEqual([]);
  });

  it("lets the AI draft generator mutate title, content, and tags", async () => {
    const graphqlApi = graphql.link("http://localhost:4000/graphql");
    server.use(
      graphqlApi.mutation("GeneratePostContent", () =>
        HttpResponse.json({
          data: {
            generatePostContent: {
              __typename: "GeneratedPost",
              title: "AI Title",
              body: "<p>AI body</p>",
              summary: "AI summary",
              tags: ["ai", "react"],
            },
          },
        }),
      ),
    );

    const { result } = renderHook(
      () => usePostAuthoringController({ mode: "create" }),
      { wrapper },
    );

    act(() => result.current.setters.setPostPrompt("a".repeat(40)));
    await act(async () => {
      await result.current.handlers.handleGeneratePost();
    });

    expect(result.current.state.title).toBe("AI Title");
    expect(result.current.state.content).toBe("<p>AI body</p>");
    expect(result.current.state.tags).toEqual(["ai", "react"]);
    expect(result.current.state.generatedSummary).toBe("AI summary");
  });

  it("toggleSummary flips the visibility flag", () => {
    const { result } = renderHook(
      () => usePostAuthoringController({ mode: "create" }),
      { wrapper },
    );
    expect(result.current.state.isSummaryVisible).toBe(false);
    act(() => result.current.handlers.toggleSummary());
    expect(result.current.state.isSummaryVisible).toBe(true);
    act(() => result.current.handlers.toggleSummary());
    expect(result.current.state.isSummaryVisible).toBe(false);
  });

  it("clearAIDraft resets prompt, summary, and visibility", () => {
    const { result } = renderHook(
      () => usePostAuthoringController({ mode: "create" }),
      { wrapper },
    );
    act(() => result.current.setters.setPostPrompt("hello world"));
    act(() => result.current.setters.setGeneratedSummary("summary"));
    act(() => result.current.setters.setIsSummaryVisible(true));
    act(() => result.current.handlers.clearAIDraft());
    expect(result.current.state.postPrompt).toBe("");
    expect(result.current.state.generatedSummary).toBeNull();
    expect(result.current.state.isSummaryVisible).toBe(false);
  });
});
