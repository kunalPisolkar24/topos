import { Button } from "@/shared/ui/primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/shared/ui/primitives/dropdown-menu";
import { cn } from "@/shared/lib/cn";

export interface ColorPickerButtonProps {
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onSelect: (value: string) => void;
}

export function ColorPickerButton({
  label,
  value,
  options,
  onSelect,
}: ColorPickerButtonProps) {
  const swatchColor = value || "transparent";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={label}
          title={label}
          data-active={value !== "" || undefined}
          onMouseDown={(event) => event.preventDefault()}
          className="relative data-[active]:bg-primary-container data-[active]:text-primary-foreground"
        >
          <span
            aria-hidden="true"
            className="font-mono text-[0.7rem] font-bold uppercase leading-none"
          >
            A
          </span>
          <span
            aria-hidden="true"
            className={cn(
              "absolute bottom-1 left-1/2 h-1 w-3 -translate-x-1/2 border border-outline-variant/30",
              value === "" && "bg-transparent",
            )}
            style={{ backgroundColor: swatchColor }}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="w-auto border border-outline-variant/20 bg-surface-low p-3 text-foreground shadow-none ring-1 ring-outline-variant/20"
      >
        <DropdownMenuLabel className="px-0 pb-2 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </DropdownMenuLabel>
        <div className="grid grid-cols-9 gap-1">
          {options.map((option) => (
            <ColorSwatch
              key={option.value}
              color={option.value === "transparent" ? "transparent" : option.value}
              label={option.label}
              active={value === option.value}
              bordered={option.value === "transparent"}
              onClick={() => onSelect(option.value)}
            />
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface ColorSwatchProps {
  color: string;
  label: string;
  active: boolean;
  bordered?: boolean;
  onClick: () => void;
}

export function ColorSwatch({
  color,
  label,
  active,
  bordered = false,
  onClick,
}: ColorSwatchProps) {
  return (
    <button
      type="button"
      role="menuitem"
      aria-label={label}
      title={label}
      data-active={active || undefined}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "relative h-5 w-5 border border-outline-variant/30 outline-none transition-transform",
        active && "ring-1 ring-primary ring-offset-1 ring-offset-surface-low",
        !active && "hover:scale-110",
      )}
      style={{
        backgroundColor: color === "transparent" ? "transparent" : color,
        backgroundImage:
          bordered && color === "transparent"
            ? "linear-gradient(45deg, transparent 45%, rgb(158 63 78) 45%, rgb(158 63 78) 55%, transparent 55%)"
            : undefined,
      }}
    >
      {color === "transparent" ? (
        <span aria-hidden="true" className="sr-only">
          {label}
        </span>
      ) : null}
    </button>
  );
}
