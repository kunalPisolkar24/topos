import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          "h-12 w-full min-w-0 rounded-none border border-outline-variant/20 bg-surface-lowest px-4 py-2 text-sm text-foreground transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary-container disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface-low disabled:text-muted-foreground disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20",
          className
        )}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
