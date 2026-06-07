import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders } from "@/test/render-with-providers";
import { sessionStoreActions } from "@/entities/session";
import { ProtectedRoute } from "../ProtectedRoute";
import { PublicOnlyRoute } from "../PublicOnlyRoute";

describe("route guards", () => {
  it("redirects anonymous users away from protected routes", () => {
    sessionStoreActions.markAnonymous();

    renderWithProviders(
      <Routes>
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <div>Profile</div>
            </ProtectedRoute>
          }
        />
        <Route path="/signin" element={<div>Sign In Page</div>} />
      </Routes>,
      { route: "/profile" },
    );

    expect(screen.getByText("Sign In Page")).toBeInTheDocument();
  });

  it("redirects authenticated users away from public-only routes", () => {
    sessionStoreActions.markAuthenticated("test-token");

    renderWithProviders(
      <Routes>
        <Route
          path="/signin"
          element={
            <PublicOnlyRoute>
              <div>Sign In Page</div>
            </PublicOnlyRoute>
          }
        />
        <Route path="/" element={<div>Home Page</div>} />
      </Routes>,
      { route: "/signin" },
    );

    expect(screen.getByText("Home Page")).toBeInTheDocument();
  });
});
