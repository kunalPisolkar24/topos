import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Home from "@/components/pages/Home";
import SearchResultsPage from "@/components/pages/SearchResultsPage";
import ViewBlogPage from "@/components/pages/ViewBlogPage";
import { LoadingSpinner } from "@/components/utils";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { PublicOnlyRoute } from "@/routes/PublicOnlyRoute";

const Signup = lazy(() =>
  import("@/components/auth/Signup").then((module) => ({
    default: module.Signup,
  })),
);

const Signin = lazy(() =>
  import("@/components/auth/Signin").then((module) => ({
    default: module.Signin,
  })),
);

const CreateNewBlog = lazy(() =>
  import("@/components/pages/CreateNewBlog").then((module) => ({
    default: module.default,
  })),
);

const UserProfile = lazy(() =>
  import("@/components/pages/UserProfile").then((module) => ({
    default: module.default,
  })),
);

export default function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route
          path="/signup"
          element={
            <PublicOnlyRoute>
              <Signup />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/signin"
          element={
            <PublicOnlyRoute>
              <Signin />
            </PublicOnlyRoute>
          }
        />
        <Route path="/" element={<Home />} />
        <Route path="/blog/:id" element={<ViewBlogPage />} />
        <Route
          path="/create-blog"
          element={
            <ProtectedRoute>
              <CreateNewBlog />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <UserProfile />
            </ProtectedRoute>
          }
        />
        <Route path="/search" element={<SearchResultsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
