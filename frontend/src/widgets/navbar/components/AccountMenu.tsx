import { forwardRef, type ComponentPropsWithoutRef, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LogOut, PenSquare, ShieldCheck, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/primitives/avatar";
import { Button, buttonVariants } from "@/shared/ui/primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/shared/ui/primitives/dropdown-menu";
import { cn } from "@/shared/lib/cn";
import {
  getAccountIdentityName,
  getUserEmail,
  getUserInitial,
} from "@/shared/lib/account-identity";
import { useSessionStore } from "@/entities/session";
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

const stackedMenuActionClassName = cn(
  buttonVariants({ variant: "ghost", size: "lg" }),
  "w-full justify-start rounded-none border border-outline-variant/20 bg-surface-lowest px-4 font-mono text-[0.6875rem] tracking-[0.12em]",
);

const stackedMenuDestructiveClassName = cn(
  buttonVariants({ variant: "destructive", size: "lg" }),
  "w-full justify-start rounded-none border border-destructive/20 px-4 shadow-none font-mono text-[0.6875rem] tracking-[0.12em]",
);

const dropdownMenuActionClassName = cn(stackedMenuActionClassName, "cursor-pointer rounded-none");

const dropdownMenuDestructiveClassName = cn(
  stackedMenuDestructiveClassName,
  "cursor-pointer rounded-none text-destructive-foreground data-[highlighted]:bg-destructive data-[highlighted]:text-destructive-foreground",
);

const menuPanelSurfaceClassName =
  "relative overflow-hidden rounded-none border border-outline-variant/20 bg-surface-low text-foreground shadow-none";

const menuPanelTintClassName =
  "pointer-events-none absolute inset-x-0 top-0 h-16 bg-[linear-gradient(180deg,rgba(31,26,72,0.42)_0%,transparent_100%)]";

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

interface AccountTriggerButtonProps {
  avatarUrl?: string | null;
  label: string;
  initial: string;
  ariaLabel: string;
}

const AccountTriggerButton = forwardRef<
  HTMLButtonElement,
  AccountTriggerButtonProps & ComponentPropsWithoutRef<"button">
>(({ avatarUrl, label, initial, ariaLabel, className, ...props }, ref) => {
  return (
    <Button
      ref={ref}
      type="button"
      variant="ghost"
      className={cn(
        "h-auto w-auto rounded-full border border-primary/45 bg-transparent p-0.5 hover:bg-transparent focus-visible:ring-primary-container",
        className,
      )}
      aria-label={ariaLabel}
      {...props}
    >
      <UserAvatar avatarUrl={avatarUrl} label={label} initial={initial} />
    </Button>
  );
});

AccountTriggerButton.displayName = "AccountTriggerButton";

interface AccountMenuIdentityProps {
  avatarUrl?: string | null;
  displayName: string;
  email: string;
  initial: string;
}

function AccountMenuIdentity({ avatarUrl, displayName, email, initial }: AccountMenuIdentityProps) {
  return (
    <div className="relative overflow-hidden rounded-none border border-outline-variant/20 bg-surface-lowest px-4 py-3">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(31,26,72,0.14)_0%,transparent_100%)]" />
      <div className="relative flex items-center gap-3">
        <UserAvatar avatarUrl={avatarUrl} label={displayName} initial={initial} size="sm" />
        <div className="min-w-0 space-y-1 text-left">
          <p className="truncate font-mono text-[0.75rem] font-medium uppercase tracking-[0.08em] text-foreground">{displayName}</p>
          <p className="truncate font-mono text-[0.625rem] tracking-[0.08em] text-muted-foreground">{email}</p>
        </div>
      </div>
    </div>
  );
}

export type AccountMenuProps = {
  user?: UserCoreFragment | null;
  displayName: string;
  onLogout: () => void | Promise<void>;
};

export function AccountMenu({ user, displayName, onLogout }: AccountMenuProps) {
  const { pathname } = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const status = useSessionStore((state) => state.status);
  const hasHydrated = useSessionStore((state) => state.hasHydrated);
  const isAuthenticated = hasHydrated && status === "authenticated";

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const accountIdentityName = getAccountIdentityName(user, displayName);
  const userEmail = getUserEmail(user);
  const userInitial = getUserInitial(user);

  if (!isAuthenticated) {
    return (
      <>
        <Link
          to="/signin"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden h-11 px-4 md:inline-flex")}
        >
          Sign In
        </Link>
        <Link to="/signup" className={cn(buttonVariants({ size: "sm" }), "h-11 px-4")}>
          Sign Up
        </Link>
      </>
    );
  }

  const AuthoringIcon = authoringNavigation.icon;
  const ReviewIcon = reviewNavigation.icon;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <AccountTriggerButton
          avatarUrl={user?.avatarUrl}
          label={displayName}
          initial={userInitial}
          ariaLabel="Open account menu"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        forceMount
        className={cn(menuPanelSurfaceClassName, "w-[20rem] p-0")}
      >
        <div className="relative p-3">
          <div className={menuPanelTintClassName} />
          <div className="relative space-y-4">
            <AccountMenuIdentity
              avatarUrl={user?.avatarUrl}
              displayName={accountIdentityName}
              email={userEmail}
              initial={userInitial}
            />
            <div className="space-y-4 pt-1">
              <div className="space-y-1">
                <DropdownMenuLabel className="px-1 py-1 font-mono text-[0.625rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Workspace
                </DropdownMenuLabel>
                <DropdownMenuItem asChild className={dropdownMenuActionClassName}>
                  <Link to={authoringNavigation.to} className="flex w-full items-center">
                    <AuthoringIcon className="mr-2 h-4 w-4" />
                    <span>Create Blog</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className={dropdownMenuActionClassName}>
                  <Link to={reviewNavigation.to} className="flex w-full items-center">
                    <ReviewIcon className="mr-2 h-4 w-4" />
                    <span>Review</span>
                  </Link>
                </DropdownMenuItem>
              </div>
              <div className="space-y-1">
                <DropdownMenuLabel className="px-1 py-1 font-mono text-[0.625rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Identity
                </DropdownMenuLabel>
                <DropdownMenuItem asChild className={dropdownMenuActionClassName}>
                  <Link to="/profile" className="flex w-full items-center">
                    <User className="mr-2 h-4 w-4" />
                    <span>Account</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void onLogout()} className={dropdownMenuDestructiveClassName}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </div>
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
