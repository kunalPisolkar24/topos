import { useCallback, useMemo, useState, type MutableRefObject } from "react";
import type ReactQuill from "react-quill-new";
import {
  Bold,
  Code,
  Eraser,
  Image as ImageIcon,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Underline,
  Video,
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
import {
  ALIGNMENT_CYCLE,
  BACKGROUND_COLORS,
  HEADER_OPTIONS,
  TEXT_COLORS,
} from "./toolbar/constants";
import { useQuillFormat } from "./toolbar/hooks/useQuillFormat";
import { ToolbarIconButton } from "./toolbar/components/ToolbarIconButton";
import { HeaderPicker } from "./toolbar/components/HeaderPicker";
import { ColorPickerButton } from "./toolbar/components/ColorPicker";
import { MoreMenu } from "./toolbar/components/MoreMenu";

export interface ResponsiveRichTextToolbarProps {
  quillRef: MutableRefObject<ReactQuill | null>;
  onImageUpload?: () => void;
}

export function ResponsiveRichTextToolbar({
  quillRef,
  onImageUpload,
}: ResponsiveRichTextToolbarProps) {
  const { state, applyFormat, removeFormat, applyLink, cycleAlignment } =
    useQuillFormat(quillRef);
  const [moreOpen, setMoreOpen] = useState(false);

  const handleImage = useCallback(() => {
    onImageUpload?.();
  }, [onImageUpload]);

  const activeHeader = useMemo(() => {
    const match = HEADER_OPTIONS.find((option) => option.value === state.header);
    return match ? match.label : "Normal text";
  }, [state.header]);

  const activeAlign = useMemo(() => {
    const match = ALIGNMENT_CYCLE.find((entry) => entry.value === state.align);
    return match ?? ALIGNMENT_CYCLE[0];
  }, [state.align]);

  return (
    <div
      role="toolbar"
      aria-label="Long-form editor toolbar"
      data-slot="rich-text-toolbar"
      className="flex flex-wrap items-center gap-0.5 border-b border-outline-variant/20 bg-surface-low px-1.5 py-1"
    >
      <PriorityGroup>
        <HeaderPicker
          value={state.header}
          onChange={(value) => applyFormat("header", value === "0" ? false : Number(value))}
          label={activeHeader}
        />
      </PriorityGroup>

      <PriorityDivider />

      <PriorityGroup>
        <ToolbarIconButton
          label="Bold"
          icon={Bold}
          active={state.bold}
          onClick={() => applyFormat("bold", !state.bold)}
        />
        <ToolbarIconButton
          label="Italic"
          icon={Italic}
          active={state.italic}
          onClick={() => applyFormat("italic", !state.italic)}
        />
        <ToolbarIconButton
          label="Underline"
          icon={Underline}
          active={state.underline}
          onClick={() => applyFormat("underline", !state.underline)}
        />
      </PriorityGroup>

      <PriorityDivider />

      <PriorityGroup>
        <ToolbarIconButton
          label="Bullet list"
          icon={List}
          active={state.list === "bullet"}
          onClick={() =>
            applyFormat("list", state.list === "bullet" ? false : "bullet")
          }
        />
        <ToolbarIconButton
          label="Numbered list"
          icon={ListOrdered}
          active={state.list === "ordered"}
          onClick={() =>
            applyFormat("list", state.list === "ordered" ? false : "ordered")
          }
        />
      </PriorityGroup>

      <PriorityDivider />

      <PriorityGroup>
        <ToolbarIconButton label="Link" icon={LinkIcon} onClick={applyLink} />
        <ToolbarIconButton
          label="Image"
          icon={ImageIcon}
          onClick={handleImage}
        />
      </PriorityGroup>

      <SecondaryGroup className="hidden md:flex">
        <PriorityDivider />
        <PriorityGroup>
          <ToolbarIconButton
            label="Decrease indent"
            icon={IndentDecrease}
            disabled={state.indent <= 0}
            onClick={() => applyFormat("indent", Math.max(state.indent - 1, -1))}
          />
          <ToolbarIconButton
            label="Increase indent"
            icon={IndentIncrease}
            disabled={state.indent >= 8}
            onClick={() => applyFormat("indent", Math.min(state.indent + 1, 8))}
          />
        </PriorityGroup>
        <PriorityDivider />
        <PriorityGroup>
          <ToolbarIconButton
            label={activeAlign.label}
            icon={activeAlign.icon}
            active={state.align !== ""}
            onClick={cycleAlignment}
          />
        </PriorityGroup>
        <PriorityDivider />
        <PriorityGroup>
          <ToolbarIconButton
            label="Video"
            icon={Video}
            onClick={() =>
              applyFormat("video", window.prompt("Video URL", "https://") || false)
            }
          />
          <ToolbarIconButton
            label="Blockquote"
            icon={Quote}
            active={state.blockquote}
            onClick={() => applyFormat("blockquote", !state.blockquote)}
          />
          <ToolbarIconButton
            label="Code block"
            icon={Code}
            active={state.codeBlock}
            onClick={() => applyFormat("code-block", !state.codeBlock)}
          />
        </PriorityGroup>
        <PriorityDivider />
        <PriorityGroup>
          <ColorPickerButton
            label="Text color"
            value={state.color}
            options={TEXT_COLORS}
            onSelect={(color) => applyFormat("color", color)}
          />
          <ColorPickerButton
            label="Background color"
            value={state.background}
            options={BACKGROUND_COLORS}
            onSelect={(color) => applyFormat("background", color)}
          />
        </PriorityGroup>
        <PriorityDivider />
        <PriorityGroup>
          <ToolbarIconButton
            label="Clear formatting"
            icon={Eraser}
            onClick={removeFormat}
          />
        </PriorityGroup>
      </SecondaryGroup>

      <div className="ml-auto flex items-center md:hidden">
        <PriorityDivider />
        <MoreMenu
          state={state}
          activeAlign={activeAlign}
          moreOpen={moreOpen}
          onMoreOpenChange={setMoreOpen}
          onApplyFormat={applyFormat}
          onCycleAlignment={cycleAlignment}
          onRemoveFormat={removeFormat}
        />
      </div>
    </div>
  );
}

function PriorityGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-0.5" role="group">
      {children}
    </div>
  );
}
function SecondaryGroup({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("items-center gap-0.5", className)} role="group" data-slot="rich-text-toolbar-secondary">
      {children}
    </div>
  );
}
function PriorityDivider() {
  return <span aria-hidden="true" className="mx-1 h-5 w-px bg-outline-variant/20" />;
}
void Button; void DropdownMenu; void DropdownMenuContent; void DropdownMenuItem; void DropdownMenuLabel; void DropdownMenuSeparator; void DropdownMenuTrigger;
