import * as React from "react";
import { cn } from "@/shared/lib/cn";

export const Eyebrow = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p
    className={cn(
      "font-mono text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-primary",
      className,
    )}
    {...props}
  />
);

export interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

export const PageHeader = React.forwardRef<HTMLElement, PageHeaderProps>(
  ({ className, eyebrow, title, description, actions, children, ...props }, ref) => (
    <header
      ref={ref}
      className={cn(
        "relative overflow-hidden bg-surface-low p-5 ring-1 ring-outline-variant/20 sm:p-8 lg:p-10",
        className,
      )}
      {...props}
    >
      <div
        className="absolute inset-0 opacity-30 [background-image:linear-gradient(to_right,rgb(var(--outline-variant)/0.16)_1px,transparent_1px),linear-gradient(to_bottom,rgb(var(--outline-variant)/0.12)_1px,transparent_1px)] [background-size:4rem_4rem]"
        aria-hidden="true"
      />
      <div className="absolute right-0 top-0 h-28 w-28 bg-primary-container" aria-hidden="true" />
      <div className="relative max-w-3xl">
        {eyebrow ? (
          <div className="mb-5 inline-flex items-center gap-2 bg-primary-container px-3 py-2 text-primary-foreground">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="break-words text-3xl font-semibold leading-none tracking-[-0.05em] text-foreground sm:text-4xl md:text-5xl lg:text-6xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">{description}</p>
        ) : null}
        {children}
        {actions ? <div className="mt-4">{actions}</div> : null}
      </div>
    </header>
  ),
);
PageHeader.displayName = "PageHeader";
