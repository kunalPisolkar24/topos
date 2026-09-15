import { useEffect, useState, type PropsWithChildren } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useApolloClient } from "@apollo/client/react";
import { LoadingSpinner } from "@/shared/ui/feedback/LoadingSpinner";
import { Button } from "@/shared/ui/primitives/button";
import { bootstrapSession, useSessionStore } from "@/entities/session";

const ROUTE_HYDRATE_TIMEOUT_MS = 8000;

export function PublicOnlyRoute({ children }: PropsWithChildren) {
  const status = useSessionStore((state) => state.status);
  const hasHydrated = useSessionStore((state) => state.hasHydrated);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const client = useApolloClient();

  useEffect(() => {
    if (hasTimedOut) return;
    if (hasHydrated && status !== "hydrating") return;
    if (!hasHydrated || status === "hydrating") {
      const id = setTimeout(() => setHasTimedOut(true), ROUTE_HYDRATE_TIMEOUT_MS);
      return () => clearTimeout(id);
    }
  }, [hasHydrated, status, hasTimedOut]);

  const handleRetry = () => {
    setHasTimedOut(false);
    void bootstrapSession(client, ROUTE_HYDRATE_TIMEOUT_MS);
  };

  if (hasTimedOut) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-sm text-muted-foreground" role="alert">
          Session loading timed out. Please try again.
        </p>
        <Button onClick={handleRetry}>Retry</Button>
      </div>
    );
  }

  if (!hasHydrated || status === "hydrating") {
    return <LoadingSpinner />;
  }

  if (status === "authenticated") {
    return <Navigate to="/" replace />;
  }

  return children ?? <Outlet />;
}
