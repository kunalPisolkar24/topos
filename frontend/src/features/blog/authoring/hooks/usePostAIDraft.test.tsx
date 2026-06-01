import { HttpResponse, graphql } from "msw";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApolloProvider } from "@apollo/client/react";
import { MemoryRouter } from "react-router-dom";
import type { ApolloClient } from "@apollo/client";
import { server } from "@/test/server";
import { createApolloClient } from "@/shared/api";
import { env } from "@/shared/config/env";
import { MIN_PROMPT_LENGTH } from "@/entities/post/lib";
import { usePostAIDraft } from "./usePostAIDraft";

const noopUnauthorized = async () => {};

function makeApolloWrapper() {
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
  return { wrapper, _clientRef: clientRef };
}

function renderDraftHook() {
  const onTitleChange = vi.fn();
  const onContentChange = vi.fn();
  const onTagsChange = vi.fn();
  const { wrapper } = makeApolloWrapper();
  const utils = renderHook(
    () =>
      usePostAIDraft({
        onTitleChange,
        onContentChange,
        onTagsChange,
      }),
    { wrapper },
  );
  return { ...utils, onTitleChange, onContentChange, onTagsChange };
}

describe("usePostAIDraft", () => {
  it("exposes prompt state, summary state, and canGenerate flag", () => {
    const { result } = renderDraftHook();

    expect(result.current.prompt).toBe("");
    expect(result.current.summary).toBeNull();
    expect(result.current.isSummaryVisible).toBe(false);
    expect(result.current.canGenerate).toBe(false);
    expect(result.current.isGenerating).toBe(false);

    act(() => result.current.setPrompt("a".repeat(MIN_PROMPT_LENGTH + 1)));
    expect(result.current.canGenerate).toBe(true);
  });

  it("does not call the mutation when the prompt is below the minimum length", async () => {
    let called = 0;
    const graphqlApi = graphql.link("http://localhost:4000/graphql");
    server.use(
      graphqlApi.mutation("GeneratePostContent", () => {
        called += 1;
        return HttpResponse.json({ data: { generatePostContent: null } });
      }),
    );

    const { result } = renderDraftHook();
    await act(async () => {
      await result.current.generate();
    });

    expect(called).toBe(0);
  });

  it("propagates the generated title, body, tags, and summary to the parent", async () => {
    const graphqlApi = graphql.link("http://localhost:4000/graphql");
    server.use(
      graphqlApi.mutation("GeneratePostContent", () =>
        HttpResponse.json({
          data: {
            generatePostContent: {
              __typename: "GeneratedPost",
              title: "Generated Title",
              body: "<p>Generated body</p>",
              summary: "A generated summary",
              tags: ["alpha", "alpha", "beta"],
            },
          },
        }),
      ),
    );

    const { result, onTitleChange, onContentChange, onTagsChange } =
      renderDraftHook();

    act(() => result.current.setPrompt("a".repeat(MIN_PROMPT_LENGTH + 1)));
    await act(async () => {
      await result.current.generate();
    });

    await waitFor(() => {
      expect(onTitleChange).toHaveBeenCalledWith("Generated Title");
    });
    expect(onContentChange).toHaveBeenCalledWith("<p>Generated body</p>");
    expect(onTagsChange).toHaveBeenCalledWith(["alpha", "beta"]);
    expect(result.current.summary).toBe("A generated summary");
    expect(result.current.isSummaryVisible).toBe(false);
  });

  it("ignores empty title or body returned by the server", async () => {
    const graphqlApi = graphql.link("http://localhost:4000/graphql");
    server.use(
      graphqlApi.mutation("GeneratePostContent", () =>
        HttpResponse.json({
          data: {
            generatePostContent: {
              __typename: "GeneratedPost",
              title: null,
              body: "<p>body only</p>",
              summary: null,
              tags: [],
            },
          },
        }),
      ),
    );

    const { result, onTitleChange, onContentChange } = renderDraftHook();
    act(() => result.current.setPrompt("a".repeat(MIN_PROMPT_LENGTH + 1)));
    await act(async () => {
      await result.current.generate();
    });

    expect(onTitleChange).not.toHaveBeenCalled();
    expect(onContentChange).not.toHaveBeenCalled();
  });

  it("toggles summary visibility and clears all AI draft state", () => {
    const { result } = renderDraftHook();

    act(() => result.current.setPrompt("a".repeat(MIN_PROMPT_LENGTH + 1)));
    act(() => result.current.setSummary("summary"));
    act(() => result.current.setIsSummaryVisible(true));
    expect(result.current.isSummaryVisible).toBe(true);

    act(() => result.current.toggleSummary());
    expect(result.current.isSummaryVisible).toBe(false);

    act(() => result.current.clear());
    expect(result.current.prompt).toBe("");
    expect(result.current.summary).toBeNull();
    expect(result.current.isSummaryVisible).toBe(false);
  });
});
