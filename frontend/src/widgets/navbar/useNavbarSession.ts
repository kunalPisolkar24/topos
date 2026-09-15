import { useCurrentUser, useSessionActions, useSessionStore } from "@/entities/session";

export function useNavbarSession() {
  const status = useSessionStore((state) => state.status);
  const hasHydrated = useSessionStore((state) => state.hasHydrated);
  const { user } = useCurrentUser();
  const { logout } = useSessionActions();

  const isHydrating = !hasHydrated || status === "hydrating";
  const isAuthenticated = hasHydrated && status === "authenticated";

  const displayName = user?.name || user?.username || "Workspace member";
  const userInitial =
    user?.name?.charAt(0).toUpperCase() ||
    user?.username?.charAt(0).toUpperCase() ||
    user?.email?.charAt(0).toUpperCase() ||
    "U";

  return {
    user,
    status,
    hasHydrated,
    isHydrating,
    isAuthenticated,
    displayName,
    userInitial,
    logout,
  };
}
