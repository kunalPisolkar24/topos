import { HttpResponse, graphql } from "msw";
import userEvent from "@testing-library/user-event";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import {
  USERNAME_MAX_LENGTH,
  sanitizeUsernameInput,
} from "@/entities/user";
import { useSessionStore } from "@/entities/session";
import { renderWithProviders } from "@/test/render-with-providers";
import { server } from "@/test/server";
import { Signup } from "../Signup";

const graphqlApi = graphql.link("http://localhost:4000/graphql");

describe("Signup", () => {
  it("creates an account and authenticates the session", async () => {
    const user = userEvent.setup();

    server.use(
      graphqlApi.mutation("Signup", () =>
        HttpResponse.json({
          data: {
            signup: {
              __typename: "AuthPayload",
              token: "signed-up-token",
              user: {
                __typename: "User",
                id: "2",
                username: "new-user",
                email: "new@example.com",
                name: "New User",
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
        <Route path="/signup" element={<Signup />} />
        <Route path="/" element={<div>Home Page</div>} />
      </Routes>,
      { route: "/signup" },
    );

    await user.type(screen.getByLabelText(/email/i), "new@example.com");
    await user.type(screen.getByLabelText(/username/i), "new-user");
    await user.type(
      screen.getByLabelText(/^password$/i),
      "password123",
    );
    await user.type(
      screen.getByLabelText(/confirm password/i),
      "password123",
    );
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => {
      expect(screen.getByText("Home Page")).toBeInTheDocument();
    });

    expect(useSessionStore.getState().token).toBe("signed-up-token");
    expect(useSessionStore.getState().status).toBe("authenticated");
  });

  it("shows validation errors on empty submit", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Signup />);
    await user.click(screen.getByRole("button", { name: /sign up/i }));
    await waitFor(() => {
      expect(screen.getByText("Please enter a valid email address")).toBeInTheDocument();
      expect(screen.getByText("Username must be at least 3 characters")).toBeInTheDocument();
      expect(screen.getByText("Password must be at least 6 characters")).toBeInTheDocument();
    });
  });

  it("shows client-side validation when passwords do not match", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <Routes>
        <Route path="/signup" element={<Signup />} />
      </Routes>,
      { route: "/signup" },
    );

    await user.type(screen.getByLabelText(/email/i), "new@example.com");
    await user.type(screen.getByLabelText(/username/i), "new-user");
    await user.type(
      screen.getByLabelText(/^password$/i),
      "password123",
    );
    await user.type(
      screen.getByLabelText(/confirm password/i),
      "different123",
    );
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    expect(await screen.findByText("Passwords don't match")).toBeInTheDocument();
    expect(useSessionStore.getState().token).toBeNull();
  });

  it("sanitizes and limits the username before signup submission", async () => {
    const user = userEvent.setup();
    const rawUsername = `  ${"very long username ".repeat(3)}  `;
    const expectedUsername = sanitizeUsernameInput(rawUsername);
    let receivedVariables:
      | { email?: string; username?: string; password?: string }
      | undefined;

    server.use(
      graphqlApi.mutation("Signup", async ({ request }) => {
        const body = (await request.json()) as unknown as {
          variables?: { email?: string; username?: string; password?: string };
        };
        receivedVariables = body.variables;

        return HttpResponse.json({
          data: {
            signup: {
              __typename: "AuthPayload",
              token: "sanitized-signup-token",
              user: {
                __typename: "User",
                id: "3",
                username: expectedUsername,
                email: "sanitized@example.com",
                name: expectedUsername,
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
        <Route path="/signup" element={<Signup />} />
        <Route path="/" element={<div>Home Page</div>} />
      </Routes>,
      { route: "/signup" },
    );

    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: rawUsername },
    });
    await user.type(screen.getByLabelText(/email/i), "sanitized@example.com");
    await user.type(
      screen.getByLabelText(/^password$/i),
      "password123",
    );
    await user.type(
      screen.getByLabelText(/confirm password/i),
      "password123",
    );

    expect(screen.getByLabelText(/username/i)).toHaveValue(expectedUsername);

    await user.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => {
      expect(receivedVariables?.username).toBe(expectedUsername);
      expect(screen.getByText("Home Page")).toBeInTheDocument();
    });

    expect(expectedUsername.length).toBeLessThanOrEqual(USERNAME_MAX_LENGTH);
  });

  it("does not navigate when signup returns empty payload", async () => {
    const user = userEvent.setup();

    server.use(
      graphqlApi.mutation("Signup", () =>
        HttpResponse.json({ data: { signup: null } }),
      ),
    );

    renderWithProviders(
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="/" element={<div>Home Page</div>} />
      </Routes>,
      { route: "/signup" },
    );

    await user.type(screen.getByLabelText(/email/i), "fail@example.com");
    await user.type(screen.getByLabelText(/username/i), "fail-user");
    await user.type(
      screen.getByLabelText(/^password$/i),
      "password123",
    );
    await user.type(
      screen.getByLabelText(/confirm password/i),
      "password123",
    );
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.queryByText("Home Page")).not.toBeInTheDocument();
    });
  });

  it("shows a loading state while signing up", async () => {
    const user = userEvent.setup();
    let resolvePromise: (value: unknown) => void = () => {};

    server.use(
      graphqlApi.mutation("Signup", async () => {
        await new Promise((resolve) => { resolvePromise = resolve; });
        return HttpResponse.json({
          data: {
            signup: {
              __typename: "AuthPayload",
              token: "loading-token",
              user: {
                __typename: "User",
                id: "5",
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
        <Route path="/signup" element={<Signup />} />
      </Routes>,
      { route: "/signup" },
    );

    await user.type(screen.getByLabelText(/email/i), "loading@example.com");
    await user.type(screen.getByLabelText(/username/i), "loading-user");
    await user.type(
      screen.getByLabelText(/^password$/i),
      "password123",
    );
    await user.type(
      screen.getByLabelText(/confirm password/i),
      "password123",
    );
    await user.click(screen.getByRole("button", { name: /sign up/i }));

    expect(screen.getByText("Signing up...")).toBeInTheDocument();
    resolvePromise({});
  });
});
