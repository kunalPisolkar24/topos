import {
  forwardRef,
  type ComponentPropsWithoutRef,
  useEffect,
  useState,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LogOut,
  Menu,
  PenSquare,
  User,
  Waypoints,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser, useSessionActions } from "@/features/auth";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session-store";

const authoringNavigation = {
  to: "/create-blog",
  label: "Create Blog",
  icon: PenSquare,
};

const accountNavigation = {
  to: "/profile",
  label: "Account",
  icon: User,
};

function NavbarBrand() {
  return (
    <Link
      to="/"
      className="group flex min-w-0 items-center gap-3"
      aria-label="Go to home page"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-primary text-primary-foreground ring-1 ring-primary/35 transition-colors group-hover:bg-primary/90">
        <Waypoints className="h-5 w-5" />
      </span>
      <p className="font-mono text-[0.7rem] uppercase tracking-[0.28em] text-foreground">
        Topos
      </p>
    </Link>
  );
}

interface UserAvatarProps {
  avatarUrl?: string | null;
  label: string;
  initial: string;
  size?: "default" | "sm";
}

function UserAvatar({
  avatarUrl,
  label,
  initial,
  size = "default",
}: UserAvatarProps) {
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
>(
  (
    {
      avatarUrl,
      label,
      initial,
      ariaLabel,
      className,
      ...props
    },
    ref,
  ) => {
    return (
      <Button
        ref={ref}
        type="button"
        variant="ghost"
        className={cn(
          "h-auto w-auto rounded-full border border-primary/45 bg-transparent p-0.5 hover:border-primary/70 hover:bg-transparent focus-visible:ring-primary-container",
          className,
        )}
        aria-label={ariaLabel}
        {...props}
      >
        <UserAvatar
          avatarUrl={avatarUrl}
          label={label}
          initial={initial}
        />
      </Button>
    );
  },
);

AccountTriggerButton.displayName = "AccountTriggerButton";

export const StickyNavbar = () => {
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const status = useSessionStore((state) => state.status);
  const hasHydrated = useSessionStore((state) => state.hasHydrated);
  const { user } = useCurrentUser();
  const { logout } = useSessionActions();

  useEffect(() => {
    setIsAccountMenuOpen(false);
    setIsMobileMenuOpen(false);
  }, [pathname, status]);

  const handleLogout = async () => {
    setIsAccountMenuOpen(false);
    setIsMobileMenuOpen(false);
    await logout();
    navigate("/signin", { replace: true });
  };

  const handleAuthenticatedMobileToggle = () => {
    setIsMobileMenuOpen((prev) => !prev);
  };

  const isHydrating = !hasHydrated || status === "hydrating";
  const isAuthenticated = hasHydrated && status === "authenticated";
  const AuthoringIcon = authoringNavigation.icon;
  const displayName = user?.name || user?.username || "Workspace member";
  const secondaryLabel = user?.email || "Active session";
  const userInitial =
    user?.name?.charAt(0).toUpperCase() ||
    user?.username?.charAt(0).toUpperCase() ||
    user?.email?.charAt(0).toUpperCase() ||
    "U";

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-outline-variant/20 bg-background/92 text-foreground backdrop-blur-xl supports-[backdrop-filter]:bg-background/88">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(77,68,227,0.08),transparent_22%,transparent_78%,rgba(77,68,227,0.08))]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent" />

      <div className="relative mx-auto flex h-[var(--app-navbar-height)] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
        <div className="flex min-w-0 items-center gap-4">
          <NavbarBrand />
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {isHydrating ? (
            <div className="h-11 w-28 animate-pulse bg-surface-low ring-1 ring-outline-variant/20" />
          ) : isAuthenticated ? (
            <>
              <Link
                to={authoringNavigation.to}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "hidden h-11 px-4 md:inline-flex",
                )}
              >
                <AuthoringIcon className="h-4 w-4" />
                {authoringNavigation.label}
              </Link>

              <DropdownMenu
                open={isAccountMenuOpen}
                onOpenChange={setIsAccountMenuOpen}
              >
                <DropdownMenuTrigger asChild>
                  <AccountTriggerButton
                    avatarUrl={user?.avatarUrl}
                    label={displayName}
                    initial={userInitial}
                    ariaLabel="Open account menu"
                    className="hidden md:inline-flex"
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={10}
                  forceMount
                  className="w-72 rounded-none border border-outline-variant/20 bg-surface-lowest p-2 text-foreground shadow-none ring-1 ring-outline-variant/20"
                >
                  <div className="space-y-2">
                    <div className="bg-surface px-3 py-3">
                      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">
                        Member Access
                      </p>
                      <div className="mt-3 flex items-center gap-3">
                        <UserAvatar
                          avatarUrl={user?.avatarUrl}
                          label={displayName}
                          initial={userInitial}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {displayName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {secondaryLabel}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <DropdownMenuItem
                        asChild
                        className="cursor-pointer rounded-none px-3 py-2 focus:bg-surface-low focus:text-foreground"
                      >
                        <Link to="/profile" className="flex w-full items-center">
                          <User className="mr-2 h-4 w-4" />
                          <span>Account</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => void handleLogout()}
                        variant="destructive"
                        className="cursor-pointer rounded-none px-3 py-2"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Log out</span>
                      </DropdownMenuItem>
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <AccountTriggerButton
                avatarUrl={user?.avatarUrl}
                label={displayName}
                initial={userInitial}
                ariaLabel={
                  isMobileMenuOpen
                    ? "Close mobile account menu"
                    : "Open mobile account menu"
                }
                aria-expanded={isMobileMenuOpen}
                onClick={handleAuthenticatedMobileToggle}
                className="md:hidden"
              />
            </>
          ) : (
            <>
              <Link
                to="/signin"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "hidden h-11 px-4 md:inline-flex",
                )}
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className={cn(buttonVariants({ size: "sm" }), "h-11 px-4")}
              >
                Sign Up
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11 border border-outline-variant/20 bg-surface-lowest hover:bg-surface-low md:hidden"
                aria-expanded={isMobileMenuOpen}
                aria-label={
                  isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"
                }
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              >
                {isMobileMenuOpen ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Menu className="h-4 w-4" />
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {isMobileMenuOpen ? (
        <div className="relative border-t border-outline-variant/20 bg-surface-low/95 md:hidden">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
            <div className="space-y-3">
              <div className="space-y-2">
                {isAuthenticated ? (
                  <>
                    <Link
                      to={authoringNavigation.to}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "lg" }),
                        "w-full justify-start px-4",
                      )}
                    >
                      <AuthoringIcon className="h-4 w-4" />
                      {authoringNavigation.label}
                    </Link>
                    <Link
                      to={accountNavigation.to}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "lg" }),
                        "w-full justify-start border border-outline-variant/20 bg-surface-lowest px-4",
                      )}
                    >
                      <User className="h-4 w-4" />
                      {accountNavigation.label}
                    </Link>
                    <Button
                      type="button"
                      variant="destructive"
                      size="lg"
                      className="w-full justify-start"
                      onClick={() => void handleLogout()}
                    >
                      <LogOut className="h-4 w-4" />
                      Log out
                    </Button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/signin"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "lg" }),
                        "w-full justify-start border border-outline-variant/20 bg-surface-lowest px-4",
                      )}
                    >
                      Sign In
                    </Link>
                    <Link
                      to="/signup"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        buttonVariants({ size: "lg" }),
                        "w-full justify-start px-4",
                      )}
                    >
                      Sign Up
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </nav>
  );
};
