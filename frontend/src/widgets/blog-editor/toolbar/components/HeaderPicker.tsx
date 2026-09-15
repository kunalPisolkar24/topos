import { Button } from "@/shared/ui/primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/primitives/dropdown-menu";
import { cn } from "@/shared/lib/cn";
import { HEADER_OPTIONS } from "../constants";

export interface HeaderPickerProps {
  value: string;
  label: string;
  onChange: (value: string) => void;
}

export function HeaderPicker({ value, label, onChange }: HeaderPickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Heading style"
          title="Heading style"
          data-active={value !== "0" || undefined}
          className={cn(
            "min-w-[7.5rem] justify-between gap-2 text-foreground data-[active]:bg-primary-container data-[active]:text-primary-foreground",
            value !== "0" && "bg-primary-container text-primary-foreground",
          )}
        >
          <span className="truncate text-left normal-case tracking-normal">
            {label}
          </span>
          <span aria-hidden="true" className="font-mono text-[0.625rem] uppercase tracking-[0.2em]">
            H
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="min-w-[12rem] border border-outline-variant/20 bg-surface-low p-1 text-foreground shadow-none ring-1 ring-outline-variant/20"
      >
        {HEADER_OPTIONS.map((option) => {
          const isActive = option.value === value;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onChange(option.value)}
              data-active={isActive || undefined}
              className={cn(
                "gap-2 border border-transparent",
                option.value === "0" && "normal-case tracking-normal",
                option.value !== "0" && "font-semibold",
                isActive && "bg-primary-container text-primary-foreground",
              )}
            >
              <span>{option.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
