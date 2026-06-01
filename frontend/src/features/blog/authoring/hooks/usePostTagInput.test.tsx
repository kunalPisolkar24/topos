import { HttpResponse, graphql } from "msw";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApolloProvider } from "@apollo/client/react";
import { MemoryRouter } from "react-router-dom";
import type { ApolloClient } from "@apollo/client";
import { server } from "@/test/server";
import { createApolloClient } from "@/shared/api";
import { env } from "@/shared/config/env";
import { MIN_TAG_BODY_LENGTH, MIN_TAG_TITLE_LENGTH } from "@/entities/post/lib";
import { usePostTagInput } from "./usePostTagInput";

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

function renderTagHook(
  args: Partial<Parameters<typeof usePostTagInput>[0]> = {},
) {
  const merged = {
    initialTags: args.initialTags ?? [],
    title: args.title ?? "A sufficiently long title",
    contentText: args.contentText ?? "a".repeat(MIN_TAG_BODY_LENGTH + 1),
  } as const;
  return renderHook(() => usePostTagInput(merged), {
    wrapper: makeWrapper(),
  });
}

describe("usePostTagInput", () => {
  it("seeds tags from initialTags", () => {
    const { result } = renderTagHook({ initialTags: ["alpha", "beta"] });
    expect(result.current.tags).toEqual(["alpha", "beta"]);
    expect(result.current.newTag).toBe("");
    expect(result.current.isDialogOpen).toBe(false);
    expect(result.current.canGenerate).toBe(true);
  });

  it("canGenerate is false when title or body is too short", () => {
    const { result: shortTitle } = renderTagHook({
      title: "tiny",
      contentText: "a".repeat(MIN_TAG_BODY_LENGTH + 1),
    });
    expect(shortTitle.current.canGenerate).toBe(false);

    const { result: shortBody } = renderTagHook({
      title: "A long enough title",
      contentText: "short",
    });
    expect(shortBody.current.canGenerate).toBe(false);
  });

  it("adds a trimmed tag, clears newTag, and closes the dialog", () => {
    const { result } = renderTagHook();
    act(() => result.current.setNewTag("  delta  "));
    act(() => result.current.setIsDialogOpen(true));
    act(() => result.current.addTag());

    expect(result.current.tags).toEqual(["delta"]);
    expect(result.current.newTag).toBe("");
    expect(result.current.isDialogOpen).toBe(false);
  });

  it("rejects empty tags and duplicate tags without mutating state", () => {
    const { result } = renderTagHook({ initialTags: ["alpha"] });

    act(() => result.current.setNewTag("   "));
    act(() => result.current.addTag());
    expect(result.current.tags).toEqual(["alpha"]);

    act(() => result.current.setNewTag("alpha"));
    act(() => result.current.addTag());
    expect(result.current.tags).toEqual(["alpha"]);
  });

  it("removes a tag by name", () => {
    const { result } = renderTagHook({ initialTags: ["alpha", "beta", "gamma"] });
    act(() => result.current.removeTag("beta"));
    expect(result.current.tags).toEqual(["alpha", "gamma"]);
  });

  it("replaceTags normalizes and deduplicates values", () => {
    const { result } = renderTagHook({ initialTags: ["alpha"] });
    act(() => result.current.replaceTags([" beta ", "gamma", "beta", ""]));
    expect(result.current.tags).toEqual(["beta", "gamma"]);
  });

  it("generateTags merges normalized tags and reports the count", async () => {
    const graphqlApi = graphql.link("http://localhost:4000/graphql");
    server.use(
      graphqlApi.mutation("GenerateTags", () =>
        HttpResponse.json({
          data: { generateTags: ["machine-learning", "ai", "machine-learning"] },
        }),
      ),
    );

    const { result } = renderTagHook({ initialTags: ["seed"] });
    await act(async () => {
      await result.current.generateTags();
    });

    await waitFor(() => {
      expect(result.current.tags).toEqual(["seed", "machine-learning", "ai"]);
    });
    expect(result.current.isGenerating).toBe(false);
  });

  it("generateTags shows a destructive toast when the server returns no tags", async () => {
    const graphqlApi = graphql.link("http://localhost:4000/graphql");
    server.use(
      graphqlApi.mutation("GenerateTags", () =>
        HttpResponse.json({ data: { generateTags: [] } }),
      ),
    );

    const { result } = renderTagHook({ initialTags: ["seed"] });
    await act(async () => {
      await result.current.generateTags();
    });

    expect(result.current.tags).toEqual(["seed"]);
  });

  it("generateTags blocks when canGenerate is false", async () => {
    const graphqlApi = graphql.link("http://localhost:4000/graphql");
    let called = 0;
    server.use(
      graphqlApi.mutation("GenerateTags", () => {
        called += 1;
        return HttpResponse.json({ data: { generateTags: [] } });
      }),
    );

    const { result } = renderTagHook({
      title: "tiny",
      contentText: "tiny",
    });
    await act(async () => {
      await result.current.generateTags();
    });

    expect(called).toBe(0);
    expect(MIN_TAG_TITLE_LENGTH).toBeGreaterThan(0);
  });
});
