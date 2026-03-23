import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  Compass,
  LogOut,
  Menu,
  PenSquare,
  User,
  Waypoints,
  X,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser, useSessionActions } from "@/features/auth";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/session-store";

type MatchMode = "exact" | "prefix";

interface NavbarItem {
  to: string;
  label: string;
  icon: LucideIcon;
  match?: MatchMode;
}

const primaryNavigation: NavbarItem[] = [
  {
    to: "/",
    label: "Explore",
    icon: Compass,
    match: "exact",
  },
];

const authoringNavigation: NavbarItem = {
  to: "/create-blog",
  label: "Create Blog",
  icon: PenSquare,
  match: "prefix",
};

const accountNavigation: NavbarItem = {
  to: "/profile",
  label: "Account",
  icon: User,
  match: "prefix",
};

const isNavbarItemActive = (pathname: string, item: NavbarItem) => {
  if (item.match === "prefix") {
    return pathname === item.to || pathname.startsWith(`${item.to}/`);
  }

  return pathname === item.to;
};

interface NavbarRouteLinkProps {
  item: NavbarItem;
  pathname: string;
  mobile?: boolean;
  onSelect?: () => void;
}

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
      <div className="min-w-0">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.28em] text-foreground">
          Topos
        </p>
        <p className="hidden truncate text-sm text-muted-foreground sm:block">
          Editorial workspace
        </p>
      </div>
    </Link>
  );
}

function NavbarRouteLink({
  item,
  pathname,
  mobile = false,
  onSelect,
}: NavbarRouteLinkProps) {
  const Icon = item.icon;
  const isActive = isNavbarItemActive(pathname, item);

  return (
    <Link
      to={item.to}
      onClick={onSelect}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        buttonVariants({ variant: "ghost", size: mobile ? "lg" : "sm" }),
        mobile
          ? "w-full justify-start border border-outline-variant/20 bg-surface-lowest px-4"
          : "h-10 px-3.5",
        isActive
          ? "border-outline-variant/20 bg-surface-low text-foreground"
          : "text-muted-foreground hover:bg-surface-low hover:text-foreground",
      )}
    >
      {mobile ? <Icon className="h-4 w-4" /> : null}
      {item.label}
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
      className="bg-surface-lowest after:border-primary/40 after:mix-blend-normal"
    >
      <AvatarImage src={avatarUrl || undefined} alt={label} />
      <AvatarFallback className="bg-primary-container text-primary-foreground font-mono text-[0.72rem] uppercase tracking-[0.12em]">
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}

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

  const isHydrating = !hasHydrated || status === "hydrating";
  const isAuthenticated = hasHydrated && status === "authenticated";
  const AuthoringIcon = authoringNavigation.icon;
  const displayName = user?.name || user?.username || "Workspace member";
  const secondaryLabel = user?.email || "Account";
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
        <div className="flex min-w-0 items-center gap-4 lg:gap-8">
          <NavbarBrand />

          <div className="hidden items-center gap-2 md:flex">
            {primaryNavigation.map((item) => (
              <NavbarRouteLink
                key={item.to}
                item={item}
                pathname={pathname}
              />
            ))}
          </div>
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
                  <Button
                    variant="ghost"
                    className="hidden h-11 max-w-[15rem] items-center gap-3 border border-outline-variant/20 bg-surface-lowest px-2.5 font-sans normal-case tracking-normal text-left hover:bg-surface-low md:inline-flex"
                  >
                    <UserAvatar
                      avatarUrl={user?.avatarUrl}
                      label={displayName}
                      initial={userInitial}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {displayName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {secondaryLabel}
                      </p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={10}
                  forceMount
                  className="w-64 rounded-none border border-outline-variant/20 bg-surface-lowest p-1 text-foreground shadow-none ring-1 ring-outline-variant/20"
                >
                  <DropdownMenuLabel className="px-0 py-0 font-normal text-foreground">
                    <div className="flex items-center gap-3 bg-surface px-3 py-3">
                      <UserAvatar
                        avatarUrl={user?.avatarUrl}
                        label={displayName}
                        initial={userInitial}
                        size="default"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate text-sm font-medium leading-none text-foreground">
                          {displayName}
                        </p>
                        <p className="truncate text-xs leading-none text-muted-foreground">
                          {secondaryLabel}
                        </p>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-outline-variant/20" />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      asChild
                      className="cursor-pointer rounded-none px-3 py-2 focus:bg-surface-low focus:text-foreground"
                    >
                      <Link to="/profile" className="flex w-full items-center">
                        <User className="mr-2 h-4 w-4" />
                        <span>Account</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator className="bg-outline-variant/20" />
                  <DropdownMenuItem
                    onClick={() => void handleLogout()}
                    variant="destructive"
                    className="cursor-pointer rounded-none px-3 py-2"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex items-center gap-2 md:hidden">
                <div className="flex h-11 items-center justify-center border border-outline-variant/20 bg-surface-lowest px-2">
                  <UserAvatar
                    avatarUrl={user?.avatarUrl}
                    label={displayName}
                    initial={userInitial}
                    size="sm"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 border border-outline-variant/20 bg-surface-lowest hover:bg-surface-low"
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
              </div>
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
              {isAuthenticated ? (
                <div className="flex items-center gap-3 bg-surface px-4 py-4 ring-1 ring-outline-variant/20">
                  <UserAvatar
                    avatarUrl={user?.avatarUrl}
                    label={displayName}
                    initial={userInitial}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {displayName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {secondaryLabel}
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                {primaryNavigation.map((item) => (
                  <NavbarRouteLink
                    key={item.to}
                    item={item}
                    pathname={pathname}
                    mobile
                    onSelect={() => setIsMobileMenuOpen(false)}
                  />
                ))}

                {isAuthenticated ? (
                  <>
                    <NavbarRouteLink
                      item={authoringNavigation}
                      pathname={pathname}
                      mobile
                      onSelect={() => setIsMobileMenuOpen(false)}
                    />
                    <NavbarRouteLink
                      item={accountNavigation}
                      pathname={pathname}
                      mobile
                      onSelect={() => setIsMobileMenuOpen(false)}
                    />
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
