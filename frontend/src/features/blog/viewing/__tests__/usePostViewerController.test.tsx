import { HttpResponse, graphql } from "msw";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ApolloProvider } from "@apollo/client/react";
import { MemoryRouter } from "react-router-dom";
import { server } from "@/test/server";
import { createApolloClient, POST_LIST_QUERY_NAMES } from "@/shared/api";
import { env } from "@/shared/config/env";
import { usePostViewerController } from "../usePostViewerController";

const noopUnauthorized = async () => {};

describe("usePostViewerController", () => {
  it("refetches post list queries after a successful delete", async () => {
    const graphqlApi = graphql.link("http://localhost:4000/graphql");
    server.use(
      graphqlApi.query("Post", () =>
        HttpResponse.json({
          data: {
            post: {
              __typename: "Post",
              id: "abc",
              title: "Some post",
              body: "<p>body</p>",
              slug: "some-post",
              imageUrl: "https://x/y.png",
              summary: null,
              summaryStatus: "READY",
              createdAt: "2024-01-01T00:00:00Z",
              updatedAt: "2024-01-01T00:00:00Z",
              author: {
                __typename: "User",
                id: "u1",
                username: "alice",
                email: "alice@x.com",
                name: "Alice",
                bio: null,
                avatarUrl: null,
              },
              tags: [],
            },
          },
        }),
      ),
      graphqlApi.mutation("DeletePost", () =>
        HttpResponse.json({ data: { deletePost: true } }),
      ),
    );

    const localClient = createApolloClient({
      uri: env.VITE_GRAPHQL_URL,
      getToken: () => null,
      onUnauthorized: noopUnauthorized,
    });
    const refetchSpy = vi.spyOn(localClient, "refetchQueries");

    const localWrapper = ({ children }: { children: ReactNode }) => (
      <ApolloProvider client={localClient}>
        <MemoryRouter initialEntries={["/blog/abc"]}>{children}</MemoryRouter>
      </ApolloProvider>
    );

    const { result } = renderHook(
      () => usePostViewerController("abc"),
      { wrapper: localWrapper },
    );

    await waitFor(() => {
      expect(result.current.state.kind).toBe("ready");
    });

    await act(async () => {
      await result.current.deletePost();
    });

    expect(refetchSpy).toHaveBeenCalledWith({
      include: [...POST_LIST_QUERY_NAMES],
    });
  });
});
