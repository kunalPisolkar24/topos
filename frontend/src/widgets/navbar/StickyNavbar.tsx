import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/shared/ui/primitives/button";
import { cn } from "@/shared/lib/cn";
import { isPreview } from "@/shared/config/preview";
import { NavBrand } from "./components/NavBrand";
import { AccountMenu } from "./components/AccountMenu";
import { MobileMenu } from "./components/MobileMenu";
import { useNavbarSession } from "./useNavbarSession";

export const StickyNavbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, isHydrating, isAuthenticated, displayName, logout } =
    useNavbarSession();

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    setIsMobileMenuOpen(false);
    await logout();
    navigate("/signin", { replace: true });
  };

  const previewMode = isPreview();

  return (
    <nav
      className={cn(
        "fixed inset-x-0 z-50 border-b border-outline-variant/20 bg-surface-low text-foreground",
        previewMode ? "top-5" : "top-0",
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(77,68,227,0.06),transparent_24%,transparent_76%,rgba(77,68,227,0.06))]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent" />

      <div className="relative mx-auto flex h-[var(--app-navbar-height)] max-w-[88rem] items-center justify-between gap-4 px-3 sm:px-5 lg:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <NavBrand />
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {isHydrating ? (
            <div className="h-8 w-20 animate-pulse bg-surface-low ring-1 ring-outline-variant/20" />
          ) : isAuthenticated ? (
            <AccountMenu user={user} displayName={displayName} onLogout={handleLogout} />
          ) : (
            <>
              <AccountMenu user={user} displayName={displayName} onLogout={handleLogout} />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 border border-outline-variant/20 bg-surface-lowest hover:bg-surface-low md:hidden"
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
