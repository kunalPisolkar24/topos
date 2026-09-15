import {
  Code,
  Eraser,
  IndentDecrease,
  IndentIncrease,
  MoreHorizontal,
  Quote,
  Video,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/shared/ui/primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/primitives/dropdown-menu";
import { cn } from "@/shared/lib/cn";
import { BACKGROUND_COLORS, TEXT_COLORS } from "../constants";
import type { FormatState } from "../types";
import { ColorSwatch } from "./ColorPicker";

export interface MoreMenuProps {
  state: FormatState;
  activeAlign: { value: string; label: string; icon: LucideIcon };
  moreOpen: boolean;
  onMoreOpenChange: (open: boolean) => void;
  onApplyFormat: (format: string, value: unknown) => void;
  onCycleAlignment: () => void;
  onRemoveFormat: () => void;
}

export function MoreMenu({
  state,
  activeAlign,
  moreOpen,
  onMoreOpenChange,
  onApplyFormat,
  onCycleAlignment,
  onRemoveFormat,
}: MoreMenuProps) {
  return (
    <DropdownMenu open={moreOpen} onOpenChange={onMoreOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="More formatting options"
          data-active={moreOpen || undefined}
          className="data-[active]:bg-primary-container data-[active]:text-primary-foreground"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-60 border border-outline-variant/20 bg-surface-low p-0 text-foreground shadow-none ring-1 ring-outline-variant/20"
      >
        <DropdownMenuLabel className="border-b border-outline-variant/20 px-3 py-2 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">
          Formatting
        </DropdownMenuLabel>
        <MoreMenuAction
          label="Indent less"
          icon={IndentDecrease}
          disabled={state.indent <= 0}
          onClick={() => onApplyFormat("indent", Math.max(state.indent - 1, -1))}
        />
        <MoreMenuAction
          label="Indent more"
          icon={IndentIncrease}
          disabled={state.indent >= 8}
          onClick={() => onApplyFormat("indent", Math.min(state.indent + 1, 8))}
        />
        <MoreMenuAction
          label={activeAlign.label}
          icon={activeAlign.icon}
          active={state.align !== ""}
          onClick={onCycleAlignment}
        />
        <MoreMenuAction
          label="Insert video"
          icon={Video}
          onClick={() =>
            onApplyFormat("video", window.prompt("Video URL", "https://") || false)
          }
        />
        <MoreMenuAction
          label="Blockquote"
          icon={Quote}
          active={state.blockquote}
          onClick={() => onApplyFormat("blockquote", !state.blockquote)}
        />
        <MoreMenuAction
          label="Code block"
          icon={Code}
          active={state.codeBlock}
          onClick={() => onApplyFormat("code-block", !state.codeBlock)}
        />
        <DropdownMenuSeparator className="bg-outline-variant/20" />
        <DropdownMenuLabel className="px-3 py-2 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">
          Text color
        </DropdownMenuLabel>
        <div className="grid grid-cols-9 gap-1 px-3 pb-3">
          {TEXT_COLORS.map((color) => (
            <ColorSwatch
              key={color.value}
              color={color.value}
              label={color.label}
              active={state.color === color.value}
              onClick={() => onApplyFormat("color", color.value)}
            />
          ))}
        </div>
        <DropdownMenuSeparator className="bg-outline-variant/20" />
        <DropdownMenuLabel className="px-3 py-2 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">
          Background
        </DropdownMenuLabel>
        <div className="grid grid-cols-9 gap-1 px-3 pb-3">
          {BACKGROUND_COLORS.map((color) => (
            <ColorSwatch
              key={color.value}
              color={color.value === "transparent" ? "transparent" : color.value}
              label={color.label}
              active={state.background === color.value}
              bordered={color.value === "transparent"}
              onClick={() => onApplyFormat("background", color.value)}
            />
          ))}
        </div>
        <DropdownMenuSeparator className="bg-outline-variant/20" />
        <DropdownMenuItem
          onClick={onRemoveFormat}
          className="m-1 gap-2 border border-outline-variant/20 bg-surface-lowest text-foreground"
        >
          <Eraser className="h-4 w-4" aria-hidden="true" />
          <span>Clear formatting</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface MoreMenuActionProps {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export function MoreMenuAction({
  label,
  icon: Icon,
  active = false,
  disabled = false,
  onClick,
}: MoreMenuActionProps) {
  return (
    <DropdownMenuItem
      disabled={disabled}
      onClick={onClick}
      data-active={active || undefined}
      className={cn(
        "m-1 gap-2 border border-transparent bg-surface-lowest text-foreground",
        active && "border-primary/45 bg-primary-container text-primary-foreground",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{label}</span>
    </DropdownMenuItem>
  );
}
