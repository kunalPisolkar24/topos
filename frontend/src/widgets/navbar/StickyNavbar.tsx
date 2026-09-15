import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, PenSquare, ShieldCheck, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/primitives/avatar";
import { Button, buttonVariants } from "@/shared/ui/primitives/button";
import { cn } from "@/shared/lib/cn";
import { NavBrand } from "./components/NavBrand";
import { AccountMenu } from "./components/AccountMenu";
import { MobileMenu } from "./components/MobileMenu";
import { useNavbarSession } from "./useNavbarSession";

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

export const StickyNavbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, isHydrating, isAuthenticated, displayName, userInitial, logout } =
    useNavbarSession();

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    setIsMobileMenuOpen(false);
    await logout();
    navigate("/signin", { replace: true });
  };

  const AuthoringIcon = authoringNavigation.icon;
  const ReviewIcon = reviewNavigation.icon;

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-outline-variant/20 bg-surface-low text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(77,68,227,0.06),transparent_24%,transparent_76%,rgba(77,68,227,0.06))]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent" />

      <div className="relative mx-auto flex h-[var(--app-navbar-height)] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
        <div className="flex min-w-0 items-center gap-4">
          <NavBrand />
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

              <Link
                to={reviewNavigation.to}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "hidden h-11 px-4 md:inline-flex",
                )}
              >
                <ReviewIcon className="h-4 w-4" />
                {reviewNavigation.label}
              </Link>

              <AccountMenu
                user={user}
                displayName={displayName}
                onLogout={handleLogout}
              />

              <Button
                type="button"
                variant="ghost"
                className="h-auto w-auto rounded-full border border-primary/45 bg-transparent p-0.5 hover:bg-transparent focus-visible:ring-primary-container md:hidden"
                aria-label={
                  isMobileMenuOpen ? "Close mobile account menu" : "Open mobile account menu"
                }
                aria-expanded={isMobileMenuOpen}
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              >
                <Avatar
                  size="default"
                  className="size-10 bg-transparent after:border-transparent after:mix-blend-normal"
                >
                  <AvatarImage src={user?.avatarUrl || undefined} alt={displayName} />
                  <AvatarFallback className="bg-primary-container font-mono text-[0.72rem] uppercase tracking-[0.12em] text-primary-foreground">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </>
          ) : (
            <>
              <AccountMenu user={user} displayName={displayName} onLogout={handleLogout} />

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

      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        user={user}
        displayName={displayName}
        onLogout={handleLogout}
      />
    </nav>
  );
};
