import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Home from "@/pages/Home";
import SearchResultsPage from "@/pages/SearchResultsPage";
import ViewBlogPage from "@/pages/ViewBlogPage";
import { LoadingSpinner } from "@/shared/ui/feedback/LoadingSpinner";
import { ProtectedRoute } from "@/app/routing/ProtectedRoute";
import { PublicOnlyRoute } from "@/app/routing/PublicOnlyRoute";
import { hasValidEnv } from "@/shared/config/env";

const Signup = lazy(() =>
  import("@/features/auth").then((module) => ({
    default: module.Signup,
  })),
);

const Signin = lazy(() =>
  import("@/features/auth").then((module) => ({
    default: module.Signin,
  })),
);

const CreateNewBlog = lazy(() =>
  import("@/pages/CreateNewBlog").then((module) => ({
    default: module.default,
  })),
);

const UserProfile = lazy(() =>
  import("@/pages/UserProfile").then((module) => ({
    default: module.default,
  })),
);

const ReviewQueuePage = lazy(() =>
  import("@/pages/ReviewQueuePage").then((module) => ({
    default: module.default,
  })),
);

const DraftDetailPage = lazy(() =>
  import("@/pages/DraftDetailPage").then((module) => ({
    default: module.default,
  })),
);

const DraftResubmitPage = lazy(() =>
  import("@/pages/DraftResubmitPage").then((module) => ({
    default: module.default,
  })),
);

const ChatPage = lazy(() =>
  import("@/pages/ChatPage").then((module) => ({
    default: module.default,
  })),
);

export default function App() {
  if (!hasValidEnv) {
    return (
      <div
        role="alert"
        className="flex min-h-screen items-center justify-center p-6 text-center"
      >
        <div className="max-w-md space-y-2">
          <h1 className="text-lg font-semibold">Configuration error</h1>
          <p className="text-sm text-muted-foreground">
            VITE_GRAPHQL_URL is not configured. Please set it in your
            environment and reload the application.
          </p>
        </div>
      </div>
    );
  }

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
        <Route
          path="/review/:draftId/edit"
          element={
            <ProtectedRoute>
              <DraftResubmitPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/review/:draftId"
          element={
            <ProtectedRoute>
              <DraftDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/review"
          element={
            <ProtectedRoute>
              <ReviewQueuePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />
        <Route path="/search" element={<SearchResultsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
