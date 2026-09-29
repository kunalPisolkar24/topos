import { HttpResponse, graphql } from "msw";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/render-with-providers";
import { server } from "@/test/server";
import { sessionStoreActions } from "@/entities/session";
import { ProfilePublicationIndex } from "../ProfilePublicationIndex";

const graphqlApi = graphql.link("http://localhost:4000/graphql");

const setupHandlers = () => {
  server.use(
    graphqlApi.query("MyPosts", () =>
      HttpResponse.json({
        data: {
          me: {
            __typename: "User",
            id: "1",
            posts: {
              __typename: "PaginatedPosts",
              posts: [
                {
                  __typename: "Post",
                  id: "post-1",
                  title: "Published post",
                  body: "<p>hello</p>",
                  imageUrl: null,
                  createdAt: "2026-09-01T00:00:00.000Z",
                  likedByMe: false,
                  savedByMe: false,
                  author: {
                    __typename: "User",
                    id: "1",
                    username: "profile-user",
                    name: "Profile User",
                    avatarUrl: null,
                  },
                  tags: [],
                },
              ],
              totalPages: 1,
              currentPage: 1,
              totalPosts: 1,
            },
          },
        },
      }),
    ),
    graphqlApi.query("MyPostDrafts", () =>
      HttpResponse.json({
        data: {
          myPostDrafts: {
            __typename: "PaginatedPostDrafts",
            drafts: [
              {
                __typename: "PostDraft",
                id: "draft-1",
                approvalId: "ap-1",
                prompt: "write",
                title: "Rejected draft",
                body: "<p>draft</p>",
                summary: "",
                tags: [],
                status: "REJECTED",
                authorId: "1",
                postId: null,
                createdAt: "2026-09-02T00:00:00.000Z",
                updatedAt: "2026-09-02T00:00:00.000Z",
              },
            ],
            totalPages: 1,
            currentPage: 1,
            totalDrafts: 1,
          },
        },
      }),
    ),
  );
};

describe("ProfilePublicationIndex header", () => {
  beforeEach(() => {
    sessionStoreActions.markAuthenticated("profile-token");
    setupHandlers();
  });

  it("shows filter pills with counts and no duplicate summary sentence", async () => {
    renderWithProviders(<ProfilePublicationIndex userId="1" />);

    expect(await screen.findByText("Published post")).toBeInTheDocument();

    const pills = screen.getAllByRole("button", { name: /(all|published|pending|rejected)/i });
    expect(pills.map((pill) => pill.textContent)).toEqual([
      "All 2",
      "Published 1",
      "Pending 0",
      "Rejected 1",
    ]);
    expect(screen.queryByText(/entries ·/)).not.toBeInTheDocument();
  });

  it("filters rows when a pill is selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProfilePublicationIndex userId="1" />);

    expect(await screen.findByText("Published post")).toBeInTheDocument();
    expect(screen.getByText("Rejected draft")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /rejected/i }));

    expect(screen.queryByText("Published post")).not.toBeInTheDocument();
    expect(screen.getByText("Rejected draft")).toBeInTheDocument();
  });
});
