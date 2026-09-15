import { useCurrentUser, useSessionActions, useSessionStore } from "@/entities/session";
import { getDisplayName, getUserInitial } from "@/shared/lib/account-identity";

export function useNavbarSession() {
  const status = useSessionStore((state) => state.status);
  const hasHydrated = useSessionStore((state) => state.hasHydrated);
  const { user } = useCurrentUser();
  const { logout } = useSessionActions();

  const isHydrating = !hasHydrated || status === "hydrating";
  const isAuthenticated = hasHydrated && status === "authenticated";

  const displayName = getDisplayName(user);
  const userInitial = getUserInitial(user);

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
