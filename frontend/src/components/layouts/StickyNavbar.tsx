import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, Plus, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSessionActions } from "@/hooks/use-session-actions";
import { useSessionStore } from "@/stores/session-store";

export const StickyNavbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const status = useSessionStore((state) => state.status);
  const hasHydrated = useSessionStore((state) => state.hasHydrated);
  const { user } = useCurrentUser();
  const { logout } = useSessionActions();

  useEffect(() => {
    if (status === "anonymous") {
      setIsOpen(false);
    }
  }, [status]);

  const handleLogout = async () => {
    await logout();
    navigate("/signin");
  };

  const userInitial =
    user?.name?.charAt(0).toUpperCase() ||
    user?.username?.charAt(0).toUpperCase() ||
    "U";

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 bg-zinc-950/95 shadow-md backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-[50px] items-center justify-between">
          <div className="flex flex-shrink-0 items-center">
            <button
              onClick={() => navigate("/")}
              className="text-xl font-bold text-zinc-100 transition-colors hover:text-zinc-300"
            >
              <span className="hidden sm:inline">blogApp</span>
              <span className="sm:hidden">bA</span>
            </button>
          </div>

          {!hasHydrated ? (
            <div className="h-8 w-24 rounded-md bg-zinc-900/40" />
          ) : status === "authenticated" ? (
            <div className="flex items-center">
              <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={user?.avatarUrl || undefined}
                        alt={user?.name || user?.username}
                      />
                      <AvatarFallback className="bg-zinc-800 text-zinc-300">
                        {userInitial}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-64 border-zinc-800 bg-zinc-950 text-zinc-100"
                  align="end"
                  forceMount
                >
                  {user && (
                    <>
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex items-center gap-3 p-2">
                          <Avatar className="h-10 w-10">
                            <AvatarImage
                              src={user.avatarUrl || undefined}
                              alt={user.name || user.username}
                            />
                            <AvatarFallback className="bg-zinc-800 text-zinc-300">
                              {userInitial}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col space-y-1 overflow-hidden">
                            <p className="truncate text-sm font-medium leading-none">
                              {user.name || user.username}
                            </p>
                            <p className="truncate text-xs leading-none text-zinc-400">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-zinc-800" />
                    </>
                  )}
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      asChild
                      className="cursor-pointer focus:bg-zinc-800 focus:text-zinc-100"
                    >
                      <Link to="/profile" className="flex w-full items-center">
                        <User className="mr-2 h-4 w-4" />
                        <span>Account</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      asChild
                      className="cursor-pointer focus:bg-zinc-800 focus:text-zinc-100"
                    >
                      <Link
                        to="/create-blog"
                        className="flex w-full items-center"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        <span>Create a Blog</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator className="bg-zinc-800" />
                  <DropdownMenuItem
                    onClick={() => void handleLogout()}
                    className="cursor-pointer text-red-500 focus:bg-red-900/40 focus:text-red-400"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Button variant="ghost" asChild>
                <Link to="/signin">Sign In</Link>
              </Button>
              <Button asChild>
                <Link to="/signup">Sign Up</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
