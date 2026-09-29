import type { LucideIcon } from "lucide-react";
import { Button } from "@/shared/ui/primitives/button";
import { cn } from "@/shared/lib/cn";

export interface ToolbarIconButtonProps {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export function ToolbarIconButton({
  label,
  icon: Icon,
  active = false,
  disabled = false,
  onClick,
}: ToolbarIconButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      data-active={active || undefined}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "text-foreground data-[active]:bg-primary-container data-[active]:text-primary-foreground",
        active && "bg-primary-container text-primary-foreground",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}
