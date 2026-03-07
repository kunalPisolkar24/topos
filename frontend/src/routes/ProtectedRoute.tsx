import type { PropsWithChildren } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { LoadingSpinner } from "@/components/utils";
import { useSessionStore } from "@/stores/session-store";

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
