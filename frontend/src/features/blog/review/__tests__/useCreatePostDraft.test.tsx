import { HttpResponse, graphql } from "msw";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApolloProvider } from "@apollo/client/react";
import { MemoryRouter } from "react-router-dom";
import type { ApolloClient } from "@apollo/client";
import { server } from "@/test/server";
import { createApolloClient } from "@/shared/api";
import { env } from "@/shared/config/env";
import { useCreatePostDraft } from "../useCreatePostDraft";

const noopUnauthorized = async () => {};

const createWrapper = () => {
  let client!: ApolloClient;
  const wrapper = ({ children }: { children: ReactNode }) => {
    if (!client) {
      client = createApolloClient({
        uri: env.VITE_GRAPHQL_URL,
        getToken: () => null,
        onUnauthorized: noopUnauthorized,
      });
    }
    return (
      <ApolloProvider client={client}>
        <MemoryRouter initialEntries={["/create-blog"]}>{children}</MemoryRouter>
      </ApolloProvider>
    );
  };
  return { wrapper, getClient: () => client };
};

describe("useCreatePostDraft", () => {
  it("refreshes draft lists after submitting so the queue updates", async () => {
    const graphqlApi = graphql.link("http://localhost:4000/graphql");
    server.use(
      graphqlApi.mutation("CreatePostDraft", () =>
        HttpResponse.json({
          data: {
            createPostDraft: {
              __typename: "PostDraft",
              id: "draft-new",
              approvalId: "ap-new",
              prompt: "write about caches",
              title: "Generated title",
              body: "<p>body</p>",
              summary: "A summary",
              tags: ["go"],
              status: "PENDING",
              authorId: "author-9",
              postId: null,
              createdAt: "2024-01-01T00:00:00Z",
              updatedAt: "2024-01-01T00:00:00Z",
            },
          },
        }),
      ),
    );
    const { wrapper, getClient } = createWrapper();

    const { result } = renderHook(() => useCreatePostDraft(), { wrapper });
    const refetchSpy = vi.spyOn(getClient(), "refetchQueries");

    let draft: unknown;
    await act(async () => {
      draft = await result.current.submitForReview("write about caches");
    });

    expect(draft).toMatchObject({ id: "draft-new" });
    await waitFor(() => {
      expect(refetchSpy).toHaveBeenCalledWith({
        include: ["PostDrafts", "MyPostDrafts"],
      });
    });
  });

  it("rejects blank prompts without calling the API", async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreatePostDraft(), { wrapper });

    let draft: unknown = "unset";
    await act(async () => {
      draft = await result.current.submitForReview("   ");
    });

    expect(draft).toBeNull();
    expect(result.current.isSubmitting).toBe(false);
  });
});
