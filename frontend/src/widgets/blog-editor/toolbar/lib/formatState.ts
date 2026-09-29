import type { MutableRefObject } from "react";
import type { Quill } from "react-quill-new";
import type ReactQuill from "react-quill-new";
import type { FormatState } from "../types";

export function readFormatState(
  quill: Quill,
  range: { index: number; length: number },
): FormatState {
  const formats = quill.getFormat(range.index, range.length) as Record<
    string,
    unknown
  >;
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

export function isSameFormatState(
  prev: FormatState,
  next: FormatState,
): boolean {
  return (
    prev.bold === next.bold &&
    prev.italic === next.italic &&
    prev.underline === next.underline &&
    prev.list === next.list &&
    prev.blockquote === next.blockquote &&
    prev.codeBlock === next.codeBlock &&
    prev.header === next.header &&
    prev.align === next.align &&
    prev.indent === next.indent &&
    prev.color === next.color &&
    prev.background === next.background
  );
}

export function commitFormatState(
  prev: FormatState,
  editor: Quill,
  range: { index: number; length: number },
): FormatState {
  const next = readFormatState(editor, range);
  return isSameFormatState(prev, next) ? prev : next;
}

export function getEditor(
  quillRef: MutableRefObject<ReactQuill | null>,
): Quill | null {
  const instance = quillRef.current;
  if (!instance) return null;
  if (typeof instance.getEditor !== "function") return null;
  const editor = instance.getEditor();
  return editor ?? null;
}

export function getCurrentRange(
  editor: Quill,
): { index: number; length: number } | null {
  if (typeof editor.getSelection !== "function") return null;
  const range = editor.getSelection();
  if (!range) return null;
  if (typeof range.index !== "number" || typeof range.length !== "number") {
    return null;
  }
  return range;
}

export function focusIfNeeded(editor: Quill): void {
  if (typeof editor.hasFocus === "function" && editor.hasFocus()) return;
  editor.focus();
}
