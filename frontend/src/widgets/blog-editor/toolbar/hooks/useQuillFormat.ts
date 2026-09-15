import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type { Quill } from "react-quill-new";
import type ReactQuill from "react-quill-new";
import { ALIGNMENT_CYCLE } from "../constants";
import { INITIAL_STATE, type FormatState } from "../types";
import {
  commitFormatState,
  focusIfNeeded,
  getCurrentRange,
  getEditor,
} from "../lib/formatState";

export interface UseQuillFormatReturn {
  state: FormatState;
  applyFormat: (format: string, value: unknown) => void;
  removeFormat: () => void;
  applyLink: () => void;
  cycleAlignment: () => void;
}

export function useQuillFormat(
  quillRef: MutableRefObject<ReactQuill | null>,
): UseQuillFormatReturn {
  const [state, setState] = useState<FormatState>(INITIAL_STATE);
  const editorRef = useRef<Quill | null>(null);
  const refreshScheduled = useRef(false);

  const refreshState = useCallback(() => {
    const editor = getEditor(quillRef);
    if (!editor) return;
    editorRef.current = editor;
    const range = getCurrentRange(editor);
    if (!range) return;
    setState((prev) => commitFormatState(prev, editor, range));
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
      const range = getCurrentRange(editor);
      if (range) {
        setState((prev) => commitFormatState(prev, editor, range));
      }
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
      focusIfNeeded(editor);
      editor.format(format, value);
      const range = getCurrentRange(editor) ?? { index: 0, length: 0 };
      setState((prev) => commitFormatState(prev, editor, range));
    },
    [quillRef],
  );

  const removeFormat = useCallback(() => {
    const editor = editorRef.current ?? getEditor(quillRef);
    if (!editor) return;
    focusIfNeeded(editor);
    editor.removeFormat(0, editor.getLength());
    const range = getCurrentRange(editor) ?? { index: 0, length: 0 };
    setState((prev) => commitFormatState(prev, editor, range));
  }, [quillRef]);

  const applyLink = useCallback(() => {
    const editor = editorRef.current ?? getEditor(quillRef);
    if (!editor) return;
    focusIfNeeded(editor);
    const tooltip = editor.getModule("tooltip") as
      | { editLink?: () => void }
      | undefined;
    if (tooltip?.editLink) {
      tooltip.editLink();
      const range = getCurrentRange(editor) ?? { index: 0, length: 0 };
      setState((prev) => commitFormatState(prev, editor, range));
      return;
    }
    const range = getCurrentRange(editor);
    if (!range) return;
    const value = window.prompt("Enter link URL", "https://");
    if (value === null) return;
    if (value === "") {
      editor.format("link", false);
    } else {
      editor.format("link", value);
    }
    setState((prev) => commitFormatState(prev, editor, range));
  }, [quillRef]);

  const cycleAlignment = useCallback(() => {
    const editor = editorRef.current ?? getEditor(quillRef);
    if (!editor) return;
    const currentIndex = ALIGNMENT_CYCLE.findIndex(
      (entry) => entry.value === state.align,
    );
    const next = ALIGNMENT_CYCLE[(currentIndex + 1) % ALIGNMENT_CYCLE.length];
    focusIfNeeded(editor);
    editor.format("align", next.value === "" ? false : next.value);
    const range = getCurrentRange(editor) ?? { index: 0, length: 0 };
    setState((prev) => commitFormatState(prev, editor, range));
  }, [quillRef, state.align]);

  return {
    state,
    applyFormat,
    removeFormat,
    applyLink,
    cycleAlignment,
  };
}
