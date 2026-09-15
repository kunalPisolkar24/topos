import { useEffect, useState, type PropsWithChildren } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useApolloClient } from "@apollo/client/react";
import { LoadingSpinner } from "@/shared/ui/feedback/LoadingSpinner";
import { Button } from "@/shared/ui/primitives/button";
import { bootstrapSession, useSessionStore } from "@/entities/session";

const ROUTE_HYDRATE_TIMEOUT_MS = 8000;

export function ProtectedRoute({ children }: PropsWithChildren) {
  const location = useLocation();
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
        <div className="flex gap-2">
          <Button onClick={handleRetry}>Retry</Button>
          <Button variant="outline" onClick={() => window.location.assign("/signin")}>
            Go to Sign In
          </Button>
        </div>
      </div>
    );
  }

  if (!hasHydrated || status === "hydrating") {
    return <LoadingSpinner />;
  }

  if (status !== "authenticated") {
    return <Navigate to="/signin" replace state={{ from: location }} />;
  }

  return children ?? <Outlet />;
}
