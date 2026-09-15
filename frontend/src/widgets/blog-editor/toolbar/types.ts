export type FormatState = {
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

export const INITIAL_STATE: FormatState = {
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
