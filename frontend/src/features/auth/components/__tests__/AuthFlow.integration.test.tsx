import { HttpResponse, graphql } from "msw";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders } from "@/test/render-with-providers";
import { server } from "@/test/server";
import { sessionStoreActions, useSessionStore } from "@/entities/session";
import { Signin } from "../Signin";

const graphqlApi = graphql.link("http://localhost:4000/graphql");

describe("AuthFlow - integration", () => {
  beforeEach(() => {
    sessionStoreActions.resetForTests();
  });

  it("signs in and redirects to the home page with authenticated session", async () => {
    const user = userEvent.setup();

    server.use(
      graphqlApi.mutation("Signin", () =>
        HttpResponse.json({
          data: {
            signin: {
              __typename: "AuthPayload",
              token: "signin-test-token",
              user: {
                __typename: "User",
                id: "1",
                username: "signin-user",
                email: "signin@example.com",
                name: "Signin User",
                bio: null,
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
        <Route path="/" element={<div>Home Page After Signin</div>} />
      </Routes>,
      { route: "/signin" },
    );

    await user.type(screen.getByLabelText(/email address/i), "signin@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "correct-password");

    await user.click(screen.getByRole("button", { name: /sign in$/i }));

    await waitFor(() => {
      expect(screen.getByText("Home Page After Signin")).toBeInTheDocument();
    });

    expect(useSessionStore.getState().token).toBe("signin-test-token");
    expect(useSessionStore.getState().status).toBe("authenticated");
  });

  it("shows loading state while the signin mutation is in flight", async () => {
    const user = userEvent.setup();
    let resolvePromise: (value: unknown) => void = () => {};

    server.use(
      graphqlApi.mutation("Signin", async () => {
        await new Promise((resolve) => { resolvePromise = resolve; });
        return HttpResponse.json({
          data: {
            signin: {
              __typename: "AuthPayload",
              token: "loading-token",
              user: {
                __typename: "User",
                id: "2",
                username: "loading-user",
                email: "loading@example.com",
                name: "Loading User",
                bio: null,
                avatarUrl: null,
                bannerUrl: null,
                createdAt: new Date().toISOString(),
              },
            },
          },
        });
      }),
    );

    renderWithProviders(
      <Routes>
        <Route path="/signin" element={<Signin />} />
        <Route path="/" element={<div>Home Page</div>} />
      </Routes>,
      { route: "/signin" },
    );

    await user.type(screen.getByLabelText(/email address/i), "loading@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "password123");

    await user.click(screen.getByRole("button", { name: /sign in$/i }));

    expect(screen.getByText("Signing In...")).toBeInTheDocument();

    resolvePromise({});
  });
});
