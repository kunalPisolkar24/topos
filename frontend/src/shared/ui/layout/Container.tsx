import * as React from "react";
import { cn } from "@/shared/lib/cn";

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "default" | "narrow" | "wide";
}

const sizeClass: Record<NonNullable<ContainerProps["size"]>, string> = {
  default: "max-w-[88rem]",
  wide: "max-w-[88rem]",
  narrow: "max-w-3xl",
};

export const Container = React.forwardRef<HTMLDivElement, ContainerProps>(
  ({ className, size = "default", ...props }, ref) => (
    <div
      ref={ref}
      className={cn("mx-auto w-full px-4 sm:px-5 lg:px-6", sizeClass[size], className)}
      {...props}
    />
  ),
);
Container.displayName = "Container";
