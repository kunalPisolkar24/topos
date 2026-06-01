import { HttpResponse, graphql } from "msw";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { useSessionStore } from "@/entities/session";
import { renderWithProviders } from "@/test/render-with-providers";
import { server } from "@/test/server";
import { Signin } from "./Signin";

describe("Signin", () => {
  it("signs in successfully and stores the token", async () => {
    const user = userEvent.setup();
    const graphqlApi = graphql.link("http://localhost:4000/graphql");

    server.use(
      graphqlApi.mutation("Signin", () =>
        HttpResponse.json({
          data: {
            signin: {
              __typename: "AuthPayload",
              token: "signed-in-token",
              user: {
                __typename: "User",
                id: "1",
                username: "demo",
                email: "demo@example.com",
                name: "Demo User",
                bio: "Bio",
                avatarUrl: null,
                bannerUrl: null,
                createdAt: new Date().toISOString(),
              },
            },
          },
        }),
      ),
    );

    renderWithProviders(
      <Routes>
        <Route path="/signin" element={<Signin />} />
        <Route path="/" element={<div>Home Page</div>} />
      </Routes>,
      { route: "/signin" },
    );

    await user.type(
      screen.getByLabelText(/email/i),
      "demo@example.com",
    );
    await user.type(screen.getByLabelText(/^password$/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("Home Page")).toBeInTheDocument();
    });

    expect(useSessionStore.getState().token).toBe("signed-in-token");
    expect(useSessionStore.getState().status).toBe("authenticated");
  });
});
