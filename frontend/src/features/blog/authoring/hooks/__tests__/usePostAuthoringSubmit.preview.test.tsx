import { HttpResponse, graphql } from "msw";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApolloProvider } from "@apollo/client/react";
import { MemoryRouter } from "react-router-dom";
import type { ApolloClient } from "@apollo/client";
import { server } from "@/test/server";
import { createApolloClient } from "@/shared/api";
import { env } from "@/shared/config/env";
import { usePostAuthoringSubmit } from "../usePostAuthoringSubmit";

vi.mock("@/shared/config/preview", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/config/preview")>();
  return { ...actual, isPreview: () => true };
});

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
        <MemoryRouter initialEntries={["/create-blog"]}>{children}</MemoryRouter>
      </ApolloProvider>
    );
  };
  return wrapper;
}

const baseArgs = {
  title: "A human title",
  content: "<p>human body</p>",
  contentText: "human body",
  imageFile: null as File | null,
  imageUrl: "https://x/cover.png",
  tags: ["alpha"],
  summary: "A summary",
  uploadCardImage: () => Promise.resolve<string | null>("https://x/cover.png"),
};

describe("usePostAuthoringSubmit in preview", () => {
  const wrapper = makeWrapper();

  it("routes new posts to the review queue instead of publishing", async () => {
    const graphqlApi = graphql.link("http://localhost:4000/graphql");
    let contentDraftInput: unknown;
    let createPostCalls = 0;
    server.use(
      graphqlApi.mutation("CreateContentDraft", async ({ request }) => {
        const body = (await request.json()) as unknown as {
          variables?: { input?: unknown };
        };
        contentDraftInput = body.variables?.input;
        return HttpResponse.json({
          data: {
            createContentDraft: { __typename: "PostDraft", id: "draft-9" },
          },
        });
      }),
      graphqlApi.mutation("CreatePost", () => {
        createPostCalls += 1;
        return HttpResponse.json({
          data: { createPost: { __typename: "Post", id: "post-9" } },
        });
      }),
    );

    const { result } = renderHook(
      () => usePostAuthoringSubmit({ ...baseArgs, mode: "create" }),
      { wrapper },
    );

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: () => {},
      } as unknown as React.FormEvent);
    });

    await waitFor(() => {
      expect(contentDraftInput).toEqual({
        title: "A human title",
        body: "<p>human body</p>",
        summary: "A summary",
        tags: ["alpha"],
        imageUrl: "https://x/cover.png",
        postId: null,
      });
    });
    expect(createPostCalls).toBe(0);
    expect(result.current.submit).toEqual({ kind: "idle" });
  });

  it("routes edits to a revision proposal linked to the live post", async () => {
    const graphqlApi = graphql.link("http://localhost:4000/graphql");
    let contentDraftInput: unknown;
    let updatePostCalls = 0;
    server.use(
      graphqlApi.mutation("CreateContentDraft", async ({ request }) => {
        const body = (await request.json()) as unknown as {
          variables?: { input?: unknown };
        };
        contentDraftInput = body.variables?.input;
        return HttpResponse.json({
          data: {
            createContentDraft: { __typename: "PostDraft", id: "draft-10" },
          },
        });
      }),
      graphqlApi.mutation("UpdatePost", () => {
        updatePostCalls += 1;
        return HttpResponse.json({
          data: { updatePost: { __typename: "Post", id: "abc" } },
        });
      }),
    );

    const onComplete = vi.fn();
    const { result } = renderHook(
      () =>
        usePostAuthoringSubmit({
          ...baseArgs,
          mode: "edit",
          title: "Revised title",
          content: "<p>revised body</p>",
          post: {
            id: "abc",
            title: "Old title",
            body: "<p>old body</p>",
            imageUrl: "https://x/cover.png",
            tags: [{ id: "t1", name: "alpha" }],
          },
          onComplete,
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: () => {},
      } as unknown as React.FormEvent);
    });

    await waitFor(() => {
      expect(contentDraftInput).toMatchObject({
        title: "Revised title",
        body: "<p>revised body</p>",
        postId: "abc",
      });
    });
    expect(updatePostCalls).toBe(0);
    expect(onComplete).toHaveBeenCalled();
    expect(result.current.submit).toEqual({ kind: "idle" });
  });
});
