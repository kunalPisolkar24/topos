import type { PropsWithChildren } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { LoadingSpinner } from "@/shared/ui/feedback/LoadingSpinner";
import { useSessionStore } from "@/entities/session";

export function PublicOnlyRoute({ children }: PropsWithChildren) {
  const status = useSessionStore((state) => state.status);
  const hasHydrated = useSessionStore((state) => state.hasHydrated);

  if (!hasHydrated || status === "hydrating") {
    return <LoadingSpinner />;
  }

  if (status === "authenticated") {
    return <Navigate to="/" replace />;
  }

  return children ?? <Outlet />;
}
