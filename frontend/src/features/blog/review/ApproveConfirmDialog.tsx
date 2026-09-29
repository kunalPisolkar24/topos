import type React from "react";
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
import { CheckCircle2 } from "lucide-react";
import type { PostDraft } from "@/shared/graphql/content-documents";

interface ApproveConfirmDialogProps {
  draft: PostDraft | null;
  isSubmitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (draft: PostDraft) => void;
}

export const ApproveConfirmDialog: React.FC<ApproveConfirmDialogProps> = ({
  draft,
  isSubmitting = false,
  onOpenChange,
  onConfirm,
}) => (
  <AlertDialog open={Boolean(draft)} onOpenChange={onOpenChange}>
    <AlertDialogContent className="flex max-h-[85vh] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden bg-surface-lowest p-0 ring-outline-variant/20 sm:max-w-lg">
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <AlertDialogHeader className="place-items-start text-left">
          <AlertDialogMedia className="mb-0 rounded-none bg-primary text-primary-foreground">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle className="text-left font-sans text-[1.0625rem] font-semibold tracking-[-0.02em]">Approve this draft?</AlertDialogTitle>
          <AlertDialogDescription className="text-left font-sans leading-6">
            <span className="block">Publishes under the author&apos;s name as-is. No edits —</span>
            <span className="block">the paused AI workflow resumes and the post goes live.</span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {draft && (
          <div className="mt-4 bg-surface-low p-4 ring-1 ring-outline-variant/20">
            <p className="font-mono text-[0.625rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">Draft preview</p>
            <p className="mt-3 line-clamp-2 break-words font-sans text-sm font-semibold leading-5 tracking-[-0.015em] text-foreground">{draft.title}</p>
            <p className="mt-2 line-clamp-2 break-words font-sans text-xs leading-6 text-muted-foreground">{draft.summary || draft.prompt}</p>
            {draft.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-primary">
                {draft.tags.slice(0, 4).map((tag) => (
                  <span key={tag}>#{tag.toLowerCase()}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <AlertDialogFooter className="mx-0 mb-0 shrink-0 border-outline-variant/20 bg-surface-low">
        <AlertDialogCancel disabled={isSubmitting} className="w-full sm:w-auto">
          Cancel
        </AlertDialogCancel>
        <Button
          type="button"
          className="w-full sm:w-auto"
          disabled={isSubmitting || !draft}
          onClick={() => draft && onConfirm(draft)}
        >
          {isSubmitting ? "Approving..." : "Approve & Publish"}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
