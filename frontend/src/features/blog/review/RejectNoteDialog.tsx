import type React from "react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogMedia,
} from "@/shared/ui/primitives/alert-dialog";
import { Button } from "@/shared/ui/primitives/button";
import { Label } from "@/shared/ui/primitives/label";
import { Textarea } from "@/shared/ui/primitives/textarea";
import { ShieldAlert } from "lucide-react";
import type { PostDraft } from "@/shared/graphql/content-documents";
import { rejectNoteSchema, REJECT_NOTE_MIN, REJECT_NOTE_MAX, type RejectNoteFormValues } from "./model/reject-note.schema";

interface RejectNoteDialogProps {
  draft: PostDraft | null;
  isSubmitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (draft: PostDraft, note: string) => void;
}

export const RejectNoteDialog: React.FC<RejectNoteDialogProps> = ({
  draft,
  isSubmitting = false,
  onOpenChange,
  onConfirm,
}) => {
  const form = useForm<RejectNoteFormValues>({
    resolver: zodResolver(rejectNoteSchema),
    defaultValues: { note: "" },
  });

  useEffect(() => {
    if (draft) form.reset({ note: "" });
  }, [draft, form]);

  const handleSubmit = form.handleSubmit((values) => {
    if (!draft) return;
    onConfirm(draft, values.note.trim());
  });

  const watched = form.watch("note") ?? "";
  const count = watched.length;

  return (
    <AlertDialog open={Boolean(draft)} onOpenChange={onOpenChange}>
      <AlertDialogContent className="flex max-h-[85vh] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden bg-surface-lowest p-0 ring-outline-variant/20 sm:max-w-lg">
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <AlertDialogHeader className="place-items-start text-left">
            <AlertDialogMedia className="mb-0 rounded-none bg-destructive/10 text-destructive">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            </AlertDialogMedia>
            <AlertDialogTitle className="text-left font-sans text-[1.0625rem] font-semibold tracking-[-0.02em]">Reject this draft?</AlertDialogTitle>
            <AlertDialogDescription className="text-left font-sans leading-6">
              Nothing gets published. The author sees your note and can edit to resubmit. The draft leaves the community queue.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {draft && (
            <div className="mt-4 space-y-4">
              <div className="bg-surface-low p-4 ring-1 ring-outline-variant/20">
                <p className="font-mono text-[0.625rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">Draft preview</p>
                <p className="mt-3 line-clamp-2 break-words font-sans text-sm font-semibold leading-5 tracking-[-0.015em] text-foreground">{draft.title}</p>
              </div>

              <form id="reject-note-form" onSubmit={handleSubmit} className="space-y-2">
                <Label htmlFor="reject-note" className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">
                  Rejection note * (required)
                </Label>
                <Textarea
                  id="reject-note"
                  rows={4}
                  maxLength={REJECT_NOTE_MAX + 50}
                  placeholder="Why is this being rejected?"
                  className="min-h-24 bg-surface-lowest ring-outline-variant/20"
                  aria-invalid={Boolean(form.formState.errors.note) || undefined}
                  {...form.register("note")}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-[0.625rem] text-muted-foreground">
                    {count}/{REJECT_NOTE_MAX}
                    {count < REJECT_NOTE_MIN && count > 0 ? ` — min ${REJECT_NOTE_MIN}` : ""}
                  </p>
                  {form.formState.errors.note ? (
                    <p className="text-xs text-destructive">{form.formState.errors.note.message}</p>
                  ) : (
                    <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted-foreground">Be specific and kind</p>
                  )}
                </div>
              </form>
            </div>
          )}
        </div>

        <AlertDialogFooter className="mx-0 mb-0 shrink-0 border-outline-variant/20 bg-surface-low">
          <AlertDialogCancel disabled={isSubmitting} className="w-full sm:w-auto">
            Cancel
          </AlertDialogCancel>
          <Button type="submit" form="reject-note-form" variant="destructive" disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? "Rejecting..." : "Reject draft"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
