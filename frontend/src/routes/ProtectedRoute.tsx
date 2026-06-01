import type { PropsWithChildren } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { LoadingSpinner } from "@/shared/ui/feedback/LoadingSpinner";
import { useSessionStore } from "@/entities/session";

export function ProtectedRoute({ children }: PropsWithChildren) {
  const location = useLocation();
  const status = useSessionStore((state) => state.status);
  const hasHydrated = useSessionStore((state) => state.hasHydrated);

  if (!hasHydrated || status === "hydrating") {
    return <LoadingSpinner />;
  }

  if (status !== "authenticated") {
    return <Navigate to="/signin" replace state={{ from: location }} />;
  }

  return children ?? <Outlet />;
}
