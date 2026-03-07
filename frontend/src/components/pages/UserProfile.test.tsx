import { HttpResponse, graphql, http } from "msw";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders } from "@/test/render-with-providers";
import { server } from "@/test/server";
import { sessionStoreActions } from "@/stores/session-store";
import UserProfile from "./UserProfile";

describe("UserProfile", () => {
  it("loads the current user and updates the profile through GraphQL", async () => {
    const user = userEvent.setup();
    const graphqlApi = graphql.link("http://localhost:4000/graphql");

    sessionStoreActions.markAuthenticated("profile-token");

    server.use(
      graphqlApi.query("Me", () =>
        HttpResponse.json({
          data: {
            me: {
              __typename: "User",
              id: "1",
              username: "profile-user",
              email: "profile@example.com",
              name: "Profile User",
              bio: "Original bio",
              avatarUrl: null,
              bannerUrl: null,
              createdAt: new Date().toISOString(),
            },
          },
        }),
      ),
      graphqlApi.mutation("UpdateProfile", async ({ request }) => {
        const body = (await request.json()) as {
          variables?: { name?: string; bio?: string | null };
        };

        return HttpResponse.json({
          data: {
            updateProfile: {
              __typename: "User",
              id: "1",
              username: "profile-user",
              email: "profile@example.com",
              name: body.variables?.name ?? "Profile User",
              bio: body.variables?.bio ?? "Original bio",
              avatarUrl: null,
              bannerUrl: null,
              createdAt: new Date().toISOString(),
            },
          },
        });
      }),
      http.get("http://localhost:8787/api/users/1/posts", () =>
        HttpResponse.json({
          data: [],
          totalPages: 1,
        }),
      ),
    );

    renderWithProviders(
      <Routes>
        <Route path="/profile" element={<UserProfile />} />
      </Routes>,
      { route: "/profile" },
    );

    expect(await screen.findByText("Profile User")).toBeInTheDocument();
    expect(screen.getByText("Original bio")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /edit profile/i }));
    const displayNameInput = screen.getByLabelText(/display name/i);
    await user.clear(displayNameInput);
    await user.type(displayNameInput, "Updated User");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText("Updated User")).toBeInTheDocument();
    });
  });
});
