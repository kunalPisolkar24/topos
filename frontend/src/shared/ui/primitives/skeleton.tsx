import { cn } from "@/shared/lib/cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-none bg-surface-low", className)}
      {...props}
    />
  )
}

export { Skeleton }
