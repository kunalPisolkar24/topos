import type { CSSProperties } from "react"
import { Toaster as SonnerToaster } from "sonner"

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      closeButton
      gap={8}
      visibleToasts={3}
      offset={16}
      duration={3200}
      toastOptions={{
        style: {
          background: "rgb(var(--surface-lowest))",
          border: "1px solid rgb(var(--outline-variant) / 0.2)",
          borderRadius: "0",
          boxShadow: "none",
          color: "rgb(var(--foreground))",
          minHeight: "0",
          padding: "0.625rem 0.75rem",
        },
        classNames: {
          toast:
            "group items-start gap-2 font-sans text-foreground data-[type=error]:border-destructive/35 data-[type=success]:border-primary/35",
          content: "gap-0",
          title:
            "font-mono text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-foreground",
          description:
            "mt-1 text-xs leading-5 text-muted-foreground",
          closeButton:
            "rounded-none border-outline-variant/20 bg-surface-lowest text-muted-foreground hover:bg-surface-low hover:text-foreground",
          icon: "mt-0.5 text-primary group-data-[type=error]:text-destructive",
          error: "text-foreground",
          success: "text-foreground",
        },
      }}
      style={{ "--width": "20rem" } as CSSProperties}
    />
  )
}
