import * as React from "react";
import { sanitizeRichHtml } from "@/shared/lib/sanitize-html";
import { cn } from "@/shared/lib/cn";

export interface RichTextViewProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "dangerouslySetInnerHTML"> {
  html: string;
  proseSize?: "default" | "lg";
}

export const RichTextView = ({ html, proseSize = "lg", className, ...props }: RichTextViewProps) => {
  const clean = sanitizeRichHtml(html);
  return (
    <div
      className={cn(
        "quill-content-view prose dark:prose-invert max-w-none min-w-0 overflow-hidden break-words",
        proseSize === "lg" && "prose-lg",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: clean }}
      {...props}
    />
  );
};
