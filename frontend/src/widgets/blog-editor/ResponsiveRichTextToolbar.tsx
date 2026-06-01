import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import type ReactQuill from "react-quill";
import Quill from "quill";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
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
  MoreHorizontal,
  Quote,
  Underline,
  Video,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/shared/lib/cn";

const HEADER_OPTIONS = [
  { value: "1", label: "Heading 1" },
  { value: "2", label: "Heading 2" },
  { value: "3", label: "Heading 3" },
  { value: "4", label: "Heading 4" },
  { value: "5", label: "Heading 5" },
  { value: "6", label: "Heading 6" },
  { value: "0", label: "Normal text" },
] as const;

const TEXT_COLORS = [
  { value: "#f4f4f5", label: "Foreground" },
  { value: "#71717a", label: "Muted" },
  { value: "#a1a1aa", label: "Subtle" },
  { value: "#fafafa", label: "Paper" },
  { value: "#9e3f4e", label: "Crimson" },
  { value: "#4d44e3", label: "Indigo" },
  { value: "#60a5fa", label: "Cobalt" },
  { value: "#34d399", label: "Mint" },
  { value: "#fbbf24", label: "Amber" },
] as const;

const BACKGROUND_COLORS = [
  { value: "transparent", label: "None" },
  { value: "#1f1a48", label: "Indigo tint" },
  { value: "#161138", label: "Indigo deep" },
  { value: "#202020", label: "Surface low" },
  { value: "#2a2a2a", label: "Surface high" },
  { value: "#9e3f4e", label: "Crimson tint" },
  { value: "#1c3a2a", label: "Mint tint" },
  { value: "#3a2f1c", label: "Amber tint" },
] as const;

const ALIGNMENT_CYCLE: Array<{
  value: "" | "center" | "right" | "justify";
  label: string;
  icon: LucideIcon;
}> = [
  { value: "", label: "Align left", icon: AlignLeft },
  { value: "center", label: "Align center", icon: AlignCenter },
  { value: "right", label: "Align right", icon: AlignRight },
  { value: "justify", label: "Align justify", icon: AlignJustify },
];

type FormatState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  list: "" | "ordered" | "bullet";
  blockquote: boolean;
  codeBlock: boolean;
  header: string;
  align: "" | "center" | "right" | "justify";
  indent: number;
  color: string;
  background: string;
};

const INITIAL_STATE: FormatState = {
  bold: false,
  italic: false,
  underline: false,
  list: "",
  blockquote: false,
  codeBlock: false,
  header: "0",
  align: "",
  indent: 0,
  color: "",
  background: "",
};

function readFormatState(quill: Quill): FormatState {
  const formats = quill.getFormat() as Record<string, unknown>;
  const header = formats.header;
  const indent = Number(formats.indent ?? 0);

  return {
    bold: Boolean(formats.bold),
    italic: Boolean(formats.italic),
    underline: Boolean(formats.underline),
    list: ((formats.list as FormatState["list"]) ?? "") as FormatState["list"],
    blockquote: Boolean(formats.blockquote),
    codeBlock: Boolean(formats["code-block"]),
    header: header === undefined || header === false ? "0" : String(header),
    align: ((formats.align as FormatState["align"]) ?? "") as FormatState["align"],
    indent: Number.isFinite(indent) ? indent : 0,
    color: typeof formats.color === "string" ? formats.color : "",
    background:
      typeof formats.background === "string" ? formats.background : "",
  };
}

function getEditor(quillRef: MutableRefObject<ReactQuill | null>): Quill | null {
  const instance = quillRef.current;
  if (!instance) return null;
  if (typeof instance.getEditor !== "function") return null;
  const editor = instance.getEditor();
  return editor ?? null;
}

export interface ResponsiveRichTextToolbarProps {
  quillRef: MutableRefObject<ReactQuill | null>;
  onImageUpload?: () => void;
}

export function ResponsiveRichTextToolbar({
  quillRef,
  onImageUpload,
}: ResponsiveRichTextToolbarProps) {
  const [state, setState] = useState<FormatState>(INITIAL_STATE);
  const [moreOpen, setMoreOpen] = useState(false);
  const editorRef = useRef<Quill | null>(null);
  const refreshScheduled = useRef(false);

  const refreshState = useCallback(() => {
    const editor = getEditor(quillRef);
    if (!editor) return;
    editorRef.current = editor;
    setState(readFormatState(editor));
  }, [quillRef]);

  const scheduleRefresh = useCallback(() => {
    if (refreshScheduled.current) return;
    refreshScheduled.current = true;
    window.requestAnimationFrame(() => {
      refreshScheduled.current = false;
      refreshState();
    });
  }, [refreshState]);

  useEffect(() => {
    const attach = () => {
      const editor = getEditor(quillRef);
      if (!editor) return false;
      editorRef.current = editor;
      setState(readFormatState(editor));
      editor.on("selection-change", scheduleRefresh);
      editor.on("text-change", scheduleRefresh);
      return true;
    };

    if (attach()) return;

    const interval = window.setInterval(() => {
      if (attach()) window.clearInterval(interval);
    }, 80);

    return () => {
      window.clearInterval(interval);
      const editor = editorRef.current ?? getEditor(quillRef);
      if (editor) {
        editor.off("selection-change", scheduleRefresh);
        editor.off("text-change", scheduleRefresh);
      }
    };
  }, [quillRef, scheduleRefresh]);

  const applyFormat = useCallback(
    (format: string, value: unknown) => {
      const editor = editorRef.current ?? getEditor(quillRef);
      if (!editor) return;
      editor.focus();
      editor.format(format, value);
      setState(readFormatState(editor));
    },
    [quillRef],
  );

  const removeFormat = useCallback(() => {
    const editor = editorRef.current ?? getEditor(quillRef);
    if (!editor) return;
    editor.focus();
    editor.removeFormat(0, editor.getLength());
    setState(readFormatState(editor));
  }, [quillRef]);

  const applyLink = useCallback(() => {
    const editor = editorRef.current ?? getEditor(quillRef);
    if (!editor) return;
    editor.focus();
    const tooltip = editor.getModule("tooltip") as
      | { editLink?: () => void }
      | undefined;
    if (tooltip?.editLink) {
      tooltip.editLink();
      setState(readFormatState(editor));
      return;
    }
    const range = editor.getSelection();
    if (!range) return;
    const value = window.prompt("Enter link URL", "https://");
    if (value === null) return;
    if (value === "") {
      editor.format("link", false);
    } else {
      editor.format("link", value);
    }
    setState(readFormatState(editor));
  }, [quillRef]);

  const cycleAlignment = useCallback(() => {
    const editor = editorRef.current ?? getEditor(quillRef);
    if (!editor) return;
    const currentIndex = ALIGNMENT_CYCLE.findIndex(
      (entry) => entry.value === state.align,
    );
    const next = ALIGNMENT_CYCLE[(currentIndex + 1) % ALIGNMENT_CYCLE.length];
    editor.focus();
    editor.format("align", next.value === "" ? false : next.value);
    setState(readFormatState(editor));
  }, [quillRef, state.align]);

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
          onChange={(value) =>
            applyFormat("header", value === "0" ? false : Number(value))
          }
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
        <ToolbarIconButton
          label="Link"
          icon={LinkIcon}
          onClick={applyLink}
        />
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
            onClick={() => applyFormat("video", window.prompt("Video URL", "https://") || false)}
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
        <DropdownMenu open={moreOpen} onOpenChange={setMoreOpen}>
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
              onClick={() =>
                applyFormat("indent", Math.max(state.indent - 1, -1))
              }
            />
            <MoreMenuAction
              label="Indent more"
              icon={IndentIncrease}
              disabled={state.indent >= 8}
              onClick={() =>
                applyFormat("indent", Math.min(state.indent + 1, 8))
              }
            />
            <MoreMenuAction
              label={activeAlign.label}
              icon={activeAlign.icon}
              active={state.align !== ""}
              onClick={cycleAlignment}
            />
            <MoreMenuAction
              label="Insert video"
              icon={Video}
              onClick={() =>
                applyFormat(
                  "video",
                  window.prompt("Video URL", "https://") || false,
                )
              }
            />
            <MoreMenuAction
              label="Blockquote"
              icon={Quote}
              active={state.blockquote}
              onClick={() => applyFormat("blockquote", !state.blockquote)}
            />
            <MoreMenuAction
              label="Code block"
              icon={Code}
              active={state.codeBlock}
              onClick={() => applyFormat("code-block", !state.codeBlock)}
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
                  onClick={() => applyFormat("color", color.value)}
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
                  onClick={() => applyFormat("background", color.value)}
                />
              ))}
            </div>
            <DropdownMenuSeparator className="bg-outline-variant/20" />
            <DropdownMenuItem
              onClick={removeFormat}
              className="m-1 gap-2 border border-outline-variant/20 bg-surface-lowest text-foreground"
            >
              <Eraser className="h-4 w-4" aria-hidden="true" />
              <span>Clear formatting</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

interface ToolbarIconButtonProps {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function ToolbarIconButton({
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
    <div
      className={cn("items-center gap-0.5", className)}
      role="group"
      data-slot="rich-text-toolbar-secondary"
    >
      {children}
    </div>
  );
}

function PriorityDivider() {
  return (
    <span
      aria-hidden="true"
      className="mx-1 h-5 w-px bg-outline-variant/20"
    />
  );
}

interface HeaderPickerProps {
  value: string;
  label: string;
  onChange: (value: string) => void;
}

function HeaderPicker({ value, label, onChange }: HeaderPickerProps) {
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

interface ColorPickerButtonProps {
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onSelect: (value: string) => void;
}

function ColorPickerButton({
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

interface ColorSwatchProps {
  color: string;
  label: string;
  active: boolean;
  bordered?: boolean;
  onClick: () => void;
}

function ColorSwatch({
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
        <span
          aria-hidden="true"
          className="sr-only"
        >
          {label}
        </span>
      ) : null}
    </button>
  );
}

interface MoreMenuActionProps {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function MoreMenuAction({
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
