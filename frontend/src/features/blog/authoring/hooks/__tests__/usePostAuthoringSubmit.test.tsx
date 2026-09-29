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

const baseArgs = {
  title: "A title",
  content: "<p>body</p>",
  contentText: "body",
  imageFile: null as File | null,
  imageUrl: "https://x/y.png",
  tags: ["alpha"],
  summary: null as string | null,
  uploadCardImage: () => Promise.resolve<string | null>("https://x/y.png"),
};

describe("usePostAuthoringSubmit", () => {
  const wrapper = makeWrapper();

  it("starts in the idle state", () => {
    const { result } = renderHook(
      () => usePostAuthoringSubmit({ ...baseArgs, mode: "create" }),
      { wrapper },
    );
    expect(result.current.submit).toEqual({ kind: "idle" });
  });

  it("blocks create when title or content is missing", async () => {
    const { result } = renderHook(
      () =>
        usePostAuthoringSubmit({
          ...baseArgs,
          mode: "create",
          title: "  ",
          content: "<p>body</p>",
          contentText: "body",
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: () => {},
      } as unknown as React.FormEvent);
    });
    expect(result.current.submit).toEqual({ kind: "idle" });
  });

  it("blocks create when there is no image and no upload helper returns null", async () => {
    const { result } = renderHook(
      () =>
        usePostAuthoringSubmit({
          ...baseArgs,
          mode: "create",
          imageUrl: null,
          imageFile: null,
          uploadCardImage: () => Promise.resolve<string | null>(null),
        }),
      { wrapper },
    );
    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: () => {},
      } as unknown as React.FormEvent);
    });
    expect(result.current.submit).toEqual({ kind: "idle" });
  });

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
      () =>
        usePostAuthoringSubmit({
          ...baseArgs,
          mode: "create",
          imageUrl: null,
          imageFile: new File([new Uint8Array([1, 2, 3])], "card.png", { type: "image/png" }),
          uploadCardImage: () => Promise.resolve<string | null>("https://cdn/ok.png"),
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
        title: "A title",
        body: "<p>body</p>",
        tags: ["alpha"],
        imageUrl: "https://cdn/ok.png",
        postId: null,
      });
    });
    expect(createPostCalls).toBe(0);
    expect(result.current.submit).toEqual({ kind: "idle" });
  });

  it("submits the known image url in the draft input", async () => {
    const graphqlApi = graphql.link("http://localhost:4000/graphql");
    let receivedImageUrl: string | undefined;
    server.use(
      graphqlApi.mutation("CreateContentDraft", async ({ request }) => {
        const body = (await request.json()) as unknown as {
          variables?: { input?: { imageUrl?: string } };
        };
        receivedImageUrl = body.variables?.input?.imageUrl;
        return HttpResponse.json({
          data: {
            createContentDraft: { __typename: "PostDraft", id: "draft-1" },
          },
        });
      }),
    );

    const { result } = renderHook(
      () =>
        usePostAuthoringSubmit({
          ...baseArgs,
          mode: "create",
          imageUrl: "https://cdn/preset.png",
          imageFile: null,
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: () => {},
      } as unknown as React.FormEvent);
    });

    await waitFor(() => {
      expect(receivedImageUrl).toBe("https://cdn/preset.png");
    });
  });

  it("transitions to error when the draft mutation fails", async () => {
    const graphqlApi = graphql.link("http://localhost:4000/graphql");
    server.use(
      graphqlApi.mutation("CreateContentDraft", () =>
        HttpResponse.json({
          errors: [{ message: "Server failed", locations: undefined, path: ["createContentDraft"] }],
          data: { createContentDraft: null },
        }),
      ),
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
      expect(result.current.submit.kind).toBe("error");
    });
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
          title: "New title",
          content: "<p>new body</p>",
          post: {
            id: "abc",
            title: "old title",
            body: "<p>old body</p>",
            imageUrl: "https://x/y.png",
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
        title: "New title",
        body: "<p>new body</p>",
        postId: "abc",
      });
    });
    expect(updatePostCalls).toBe(0);
    expect(onComplete).toHaveBeenCalled();
    expect(result.current.submit).toEqual({ kind: "idle" });
  });

  it("returns to idle and calls onComplete when there are no changes", async () => {
    const onComplete = vi.fn();
    const { result } = renderHook(
      () =>
        usePostAuthoringSubmit({
          ...baseArgs,
          mode: "edit",
          title: "same",
          content: "<p>body</p>",
          post: {
            id: "abc",
            title: "same",
            body: "<p>body</p>",
            imageUrl: "https://x/y.png",
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

    expect(onComplete).toHaveBeenCalled();
    expect(result.current.submit).toEqual({ kind: "idle" });
  });

  it("refreshes draft lists after a successful review submission", async () => {
    const graphqlApi = graphql.link("http://localhost:4000/graphql");
    server.use(
      graphqlApi.mutation("CreateContentDraft", () =>
        HttpResponse.json({
          data: {
            createContentDraft: { __typename: "PostDraft", id: "draft-1" },
          },
        }),
      ),
    );

    const localClient = createApolloClient({
      uri: env.VITE_GRAPHQL_URL,
      getToken: () => null,
      onUnauthorized: noopUnauthorized,
    });
    const refetchSpy = vi.spyOn(localClient, "refetchQueries");    const localWrapper = ({ children }: { children: ReactNode }) => (
      <ApolloProvider client={localClient}>
        <MemoryRouter initialEntries={["/"]}>{children}</MemoryRouter>
      </ApolloProvider>
    );

    const { result } = renderHook(
      () => usePostAuthoringSubmit({ ...baseArgs, mode: "create" }),
      { wrapper: localWrapper },
    );

    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: () => {},
      } as unknown as React.FormEvent);
    });

    expect(refetchSpy).toHaveBeenCalledWith({
      include: ["PostDrafts", "MyPostDrafts"],
    });
  });
});
