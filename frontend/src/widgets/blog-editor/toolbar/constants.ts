import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  type LucideIcon,
} from "lucide-react";

export const HEADER_OPTIONS = [
  { value: "1", label: "Heading 1" },
  { value: "2", label: "Heading 2" },
  { value: "3", label: "Heading 3" },
  { value: "4", label: "Heading 4" },
  { value: "5", label: "Heading 5" },
  { value: "6", label: "Heading 6" },
  { value: "0", label: "Normal text" },
] as const;

export const TEXT_COLORS = [
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

export const BACKGROUND_COLORS = [
  { value: "transparent", label: "None" },
  { value: "#1f1a48", label: "Indigo tint" },
  { value: "#161138", label: "Indigo deep" },
  { value: "#202020", label: "Surface low" },
  { value: "#2a2a2a", label: "Surface high" },
  { value: "#9e3f4e", label: "Crimson tint" },
  { value: "#1c3a2a", label: "Mint tint" },
  { value: "#3a2f1c", label: "Amber tint" },
] as const;

export const ALIGNMENT_CYCLE: Array<{
  value: "" | "center" | "right" | "justify";
  label: string;
  icon: LucideIcon;
}> = [
  { value: "", label: "Align left", icon: AlignLeft },
  { value: "center", label: "Align center", icon: AlignCenter },
  { value: "right", label: "Align right", icon: AlignRight },
  { value: "justify", label: "Align justify", icon: AlignJustify },
];
