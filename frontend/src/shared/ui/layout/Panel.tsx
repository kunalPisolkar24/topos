import * as React from "react";
import { cn } from "@/shared/lib/cn";

export type PanelProps = React.HTMLAttributes<HTMLDivElement>;

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("bg-surface-lowest ring-1 ring-outline-variant/20", className)}
      {...props}
    />
  ),
);
Panel.displayName = "Panel";

export const SurfacePanel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("bg-surface-low p-3 ring-1 ring-outline-variant/20 sm:p-5", className)} {...props} />
  ),
);
SurfacePanel.displayName = "SurfacePanel";
