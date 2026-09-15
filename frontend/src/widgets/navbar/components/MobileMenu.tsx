import { Link } from "react-router-dom";
import { LogOut, PenSquare, ShieldCheck, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/primitives/avatar";
import { Button, buttonVariants } from "@/shared/ui/primitives/button";
import { cn } from "@/shared/lib/cn";
import {
  getAccountIdentityName,
  getUserEmail,
  getUserInitial,
} from "@/shared/lib/account-identity";
import type { UserCoreFragment } from "@/shared/graphql/generated/graphql";

const authoringNavigation = {
  to: "/create-blog",
  label: "Create Blog",
  icon: PenSquare,
};

const reviewNavigation = {
  to: "/review",
  label: "Review",
  icon: ShieldCheck,
};

const accountNavigation = {
  to: "/profile",
  label: "Account",
  icon: User,
};

const stackedMenuActionClassName = cn(
  buttonVariants({ variant: "ghost", size: "lg" }),
  "w-full justify-start border-outline-variant/20 bg-surface-lowest px-4",
);

const stackedMenuDestructiveClassName = cn(
  buttonVariants({ variant: "destructive", size: "lg" }),
  "w-full justify-start border border-destructive/20 px-4 shadow-none",
);

const menuPanelSurfaceClassName =
  "relative overflow-hidden rounded-none border border-outline-variant/20 bg-surface-low text-foreground shadow-none ring-1 ring-outline-variant/20";

const menuPanelTintClassName =
  "pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(31,26,72,0.88)_0%,rgba(31,26,72,0.28)_55%,transparent_100%)]";

const menuPanelDividerClassName = "h-px bg-gradient-to-r from-primary via-primary/45 to-transparent";

interface UserAvatarProps {
  avatarUrl?: string | null;
  label: string;
  initial: string;
  size?: "default" | "sm";
}

function UserAvatar({ avatarUrl, label, initial, size = "default" }: UserAvatarProps) {
  return (
    <Avatar
      size={size}
      className={cn(
        "bg-transparent after:border-transparent after:mix-blend-normal",
        size === "default" ? "size-10" : "size-9",
      )}
    >
      <AvatarImage src={avatarUrl || undefined} alt={label} />
      <AvatarFallback className="bg-primary-container text-primary-foreground font-mono text-[0.72rem] uppercase tracking-[0.12em]">
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}

interface AccountMenuIdentityProps {
  avatarUrl?: string | null;
  displayName: string;
  email: string;
  initial: string;
}

function AccountMenuIdentity({ avatarUrl, displayName, email, initial }: AccountMenuIdentityProps) {
  return (
    <div className="relative overflow-hidden border border-outline-variant/20 bg-surface-lowest px-4 py-3">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(31,26,72,0.22)_0%,transparent_100%)]" />
      <div className="relative flex items-center gap-3">
        <UserAvatar avatarUrl={avatarUrl} label={displayName} initial={initial} size="sm" />
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
          <p className="truncate font-mono text-[0.68rem] tracking-[0.08em] text-muted-foreground">{email}</p>
        </div>
      </div>
    </div>
  );
}

export type MobileMenuProps = {
  isOpen: boolean;
  onClose: () => void;
  user?: UserCoreFragment | null;
  displayName: string;
  onLogout: () => void | Promise<void>;
};

export function MobileMenu({ isOpen, onClose, user, displayName, onLogout }: MobileMenuProps) {
  if (!isOpen) return null;

  const accountIdentityName = getAccountIdentityName(user, displayName);
  const userEmail = getUserEmail(user);
  const userInitial = getUserInitial(user);

  const isAuthenticated = !!user;
  const AuthoringIcon = authoringNavigation.icon;
  const ReviewIcon = reviewNavigation.icon;

  return (
    <div className="relative border-t border-outline-variant/20 bg-surface-low md:hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent" />
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
        <div className={cn(menuPanelSurfaceClassName, "p-3 ring-0")}>
          <div className={menuPanelTintClassName} />
          <div className="relative space-y-3">
            {isAuthenticated ? (
              <>
                <AccountMenuIdentity
                  avatarUrl={user?.avatarUrl}
                  displayName={accountIdentityName}
                  email={userEmail}
                  initial={userInitial}
                />
                <div className={menuPanelDividerClassName} />
                <div className="space-y-2">
                  <Link
                    to={authoringNavigation.to}
                    onClick={onClose}
                    className={stackedMenuActionClassName}
                  >
                    <AuthoringIcon className="h-4 w-4" />
                    {authoringNavigation.label}
                  </Link>
                  <Link
                    to={reviewNavigation.to}
                    onClick={onClose}
                    className={stackedMenuActionClassName}
                  >
                    <ReviewIcon className="h-4 w-4" />
                    {reviewNavigation.label}
                  </Link>
                  <Link
                    to={accountNavigation.to}
                    onClick={onClose}
                    className={stackedMenuActionClassName}
                  >
                    <User className="h-4 w-4" />
                    {accountNavigation.label}
                  </Link>
                  <Button
                    type="button"
                    variant="destructive"
                    size="lg"
                    className={stackedMenuDestructiveClassName}
                    onClick={() => void onLogout()}
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Link to="/signin" onClick={onClose} className={stackedMenuActionClassName}>
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  onClick={onClose}
                  className={cn(buttonVariants({ size: "lg" }), "w-full justify-start px-4")}
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
