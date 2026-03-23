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
    expect(screen.getAllByRole("link", { name: /sign in/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /sign up/i }).length).toBeGreaterThan(0);
  });

  it("shows authenticated user details and mobile navigation actions", async () => {
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

    expect(await screen.findByText("Shamu 22")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /open navigation menu/i }),
    );

    expect(screen.getAllByRole("link", { name: /create blog/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /account/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log out/i })).toBeInTheDocument();
  });
});
