import { HttpResponse, graphql } from "msw";
import userEvent from "@testing-library/user-event";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import {
  PROFILE_BIO_MAX_LENGTH,
  PROFILE_NAME_MAX_LENGTH,
  sanitizeProfileBio,
  sanitizeProfileBioInput,
  sanitizeProfileName,
} from "@/lib/user-input";
import { renderWithProviders } from "@/test/render-with-providers";
import { server } from "@/test/server";
import { sessionStoreActions } from "@/stores/session-store";
import UserProfile from "./UserProfile";

describe("UserProfile", () => {
  it("sanitizes and limits profile updates before sending GraphQL variables", async () => {
    const user = userEvent.setup();
    const graphqlApi = graphql.link("http://localhost:4000/graphql");
    const rawName = `  ${"Updated Profile Name ".repeat(4)}  `;
    const rawBio = `  First   line\r\n\r\n\r\nSecond line ${"b".repeat(
      PROFILE_BIO_MAX_LENGTH + 40,
    )}`;
    const expectedName = sanitizeProfileName(rawName);
    const expectedBioInput = sanitizeProfileBioInput(rawBio);
    const expectedBio = sanitizeProfileBio(expectedBioInput);
    let receivedVariables:
      | { name?: string; bio?: string | null }
      | undefined;

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
        const body = (await request.json()) as unknown as {
          variables?: { name?: string; bio?: string | null };
        };
        receivedVariables = body.variables;

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
      graphqlApi.query("MyPosts", () =>
        HttpResponse.json({
          data: {
            me: {
              __typename: "User",
              id: "1",
              posts: {
                __typename: "PaginatedPosts",
                posts: [],
                totalPages: 1,
                currentPage: 1,
                totalPosts: 0,
              },
            },
          },
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
    const bioInput = screen.getByLabelText(/bio \/ about/i);

    fireEvent.change(displayNameInput, {
      target: { value: rawName },
    });
    fireEvent.change(bioInput, {
      target: { value: rawBio },
    });

    expect(displayNameInput).toHaveValue(expectedName);
    expect(bioInput).toHaveValue(expectedBioInput);

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText(expectedName)).toBeInTheDocument();
      expect(receivedVariables).toEqual({
        name: expectedName,
        bio: expectedBio,
      });
    });

    expect(expectedName.length).toBeLessThanOrEqual(PROFILE_NAME_MAX_LENGTH);
    expect(expectedBio.length).toBeLessThanOrEqual(PROFILE_BIO_MAX_LENGTH);
  });
});
