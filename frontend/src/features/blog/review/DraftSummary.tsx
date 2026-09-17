import type React from "react";
import { cn } from "@/shared/lib/cn";

interface DraftSummaryProps {
  summary?: string | null;
  variant?: "compact" | "full";
  className?: string;
}

const hasSummary = (value?: string | null): value is string =>
  Boolean(value?.trim());

export const DraftSummary: React.FC<DraftSummaryProps> = ({
  summary,
  variant = "full",
  className,
}) => {
  if (hasSummary(summary)) {
    return (
      <p
        className={cn(
          "whitespace-pre-wrap break-words font-sans text-sm leading-7 text-foreground/80",
          variant === "compact" && "line-clamp-2",
          className,
        )}
      >
        {summary.trim()}
      </p>
    );
  }

  return (
    <p
      className={cn(
        "font-sans text-sm leading-7 text-muted-foreground",
        variant === "compact" && "line-clamp-2",
        className,
      )}
    >
      No summary yet.
    </p>
  );
};
