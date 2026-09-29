import { z } from "zod";

export const REJECT_NOTE_MIN = 10;
export const REJECT_NOTE_MAX = 1000;

export const rejectNoteSchema = z.object({
  note: z
    .string()
    .trim()
    .min(REJECT_NOTE_MIN, `Tell the author why (min ${REJECT_NOTE_MIN} characters)`)
    .max(REJECT_NOTE_MAX, `Keep it under ${REJECT_NOTE_MAX} characters`),
});

export type RejectNoteFormValues = z.infer<typeof rejectNoteSchema>;
