import { HttpResponse, graphql } from "msw";
import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { StickyNavbar } from "@/layouts";
import { renderWithProviders } from "@/test/render-with-providers";
import { server } from "@/test/server";
import { sessionStoreActions } from "@/stores/session-store";

describe("StickyNavbar", () => {
  it("shows anonymous navigation actions after hydration", () => {
    sessionStoreActions.markAnonymous();

    renderWithProviders(<StickyNavbar />);

    expect(screen.getByRole("link", { name: /go to home page/i })).toBeInTheDocument();
    expect(screen.queryByText(/editorial workspace/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /explore/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /sign in/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /sign up/i }).length).toBeGreaterThan(0);
  });

  it("uses the avatar as the authenticated mobile navigation trigger", async () => {
    const user = userEvent.setup();
    const graphqlApi = graphql.link("http://localhost:4000/graphql");

    sessionStoreActions.markAuthenticated("test-token");

    server.use(
      graphqlApi.query("Me", () =>
        HttpResponse.json({
          data: {
            me: {
              __typename: "User",
              id: "1",
              username: "shamu22",
              email: "shamu22@example.com",
              name: "Shamu 22",
              bio: null,
              avatarUrl: null,
              bannerUrl: null,
              createdAt: new Date().toISOString(),
            },
          },
        }),
      ),
    );

    renderWithProviders(<StickyNavbar />);

    await screen.findByRole("button", { name: /open mobile account menu/i });
    expect(screen.queryByText("Shamu 22")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /open mobile account menu/i }),
    );

    expect(screen.getAllByRole("link", { name: /create blog/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /account/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log out/i })).toBeInTheDocument();
    expect(screen.queryByText("Shamu 22")).not.toBeInTheDocument();
  });

  it("opens the desktop account dropdown and shows the refreshed menu design", async () => {
    const user = userEvent.setup();
    const graphqlApi = graphql.link("http://localhost:4000/graphql");

    sessionStoreActions.markAuthenticated("test-token");

    server.use(
      graphqlApi.query("Me", () =>
        HttpResponse.json({
          data: {
            me: {
              __typename: "User",
              id: "1",
              username: "shamu22",
              email: "shamu22@example.com",
              name: "Shamu 22",
              bio: null,
              avatarUrl: null,
              bannerUrl: null,
              createdAt: new Date().toISOString(),
            },
          },
        }),
      ),
    );

    renderWithProviders(<StickyNavbar />);

    await user.click(screen.getByRole("button", { name: /open account menu/i }));

    expect(screen.getByText(/member access/i)).toBeInTheDocument();
    expect(screen.getByText("Shamu 22")).toBeInTheDocument();
    expect(screen.getByText("shamu22@example.com")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /account/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /log out/i })).toBeInTheDocument();
  });
});
