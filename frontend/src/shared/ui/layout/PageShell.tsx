import * as React from "react";
import { cn } from "@/shared/lib/cn";

export type PageShellProps = React.HTMLAttributes<HTMLDivElement>;

export const PageShell = React.forwardRef<HTMLDivElement, PageShellProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("min-h-screen bg-surface text-foreground", className)} {...props} />
  ),
);
PageShell.displayName = "PageShell";

export const PageMain = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <main
      ref={ref}
      className={cn("container mx-auto px-4 pb-20 pt-app-navbar-offset sm:px-5 lg:px-6", className)}
      {...props}
    />
  ),
);
PageMain.displayName = "PageMain";
