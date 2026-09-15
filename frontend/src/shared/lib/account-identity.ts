import type { UserCoreFragment } from "@/shared/graphql/generated/graphql";

export function getDisplayName(
  user: Pick<UserCoreFragment, "name" | "username"> | null | undefined,
  fallback = "Workspace member",
): string {
  return user?.name || user?.username || fallback;
}

export function getAccountIdentityName(
  user: Pick<UserCoreFragment, "name" | "username"> | null | undefined,
  fallbackDisplayName: string,
): string {
  return user?.username || user?.name || fallbackDisplayName;
}

export function getUserEmail(
  user: Pick<UserCoreFragment, "email"> | null | undefined,
): string {
  return user?.email || "No email on file";
}

export function getUserInitial(
  user: Pick<UserCoreFragment, "name" | "username" | "email"> | null | undefined,
): string {
  return (
    user?.name?.charAt(0).toUpperCase() ||
    user?.username?.charAt(0).toUpperCase() ||
    user?.email?.charAt(0).toUpperCase() ||
    "U"
  );
}
