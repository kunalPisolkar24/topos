import { HttpResponse, graphql } from "msw";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { useSessionStore } from "@/entities/session";
import { renderWithProviders } from "@/test/render-with-providers";
import { server } from "@/test/server";
import { Signin } from "../Signin";

const graphqlApi = graphql.link("http://localhost:4000/graphql");

describe("Signin", () => {
  it("signs in successfully and stores the token", async () => {
    const user = userEvent.setup();

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

  it("shows validation errors on empty submit", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Signin />);
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByText("Please enter a valid email address")).toBeInTheDocument();
      expect(screen.getByText("Password is required")).toBeInTheDocument();
    });
  });

  it("does not navigate when signin returns empty payload", async () => {
    const user = userEvent.setup();

    server.use(
      graphqlApi.mutation("Signin", () =>
        HttpResponse.json({ data: { signin: null } }),
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
      expect(screen.queryByText("Home Page")).not.toBeInTheDocument();
    });
  });

  it("shows a loading state while signing in", async () => {
    const user = userEvent.setup();
    let resolvePromise: (value: unknown) => void = () => {};

    server.use(
      graphqlApi.mutation("Signin", async () => {
        await new Promise((resolve) => { resolvePromise = resolve; });
        return HttpResponse.json({
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

    await user.type(
      screen.getByLabelText(/email/i),
      "demo@example.com",
    );
    await user.type(screen.getByLabelText(/^password$/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByText("Signing In...")).toBeInTheDocument();
    resolvePromise({});
    await waitFor(() => {
      expect(screen.getByText("Home Page")).toBeInTheDocument();
    });
  });

  it("navigates to the redirect target when provided", async () => {
    const user = userEvent.setup();

    server.use(
      graphqlApi.mutation("Signin", () =>
        HttpResponse.json({
          data: {
            signin: {
              __typename: "AuthPayload",
              token: "redirect-token",
              user: {
                __typename: "User",
                id: "2",
                username: "redirect-user",
                email: "redirect@example.com",
                name: null,
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
        <Route path="/create-blog" element={<div>Create Blog Page</div>} />
      </Routes>,
      { route: "/signin", state: { from: { pathname: "/create-blog" } } },
    );

    await user.type(
      screen.getByLabelText(/email/i),
      "redirect@example.com",
    );
    await user.type(screen.getByLabelText(/^password$/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("Create Blog Page")).toBeInTheDocument();
    });
  });
});
