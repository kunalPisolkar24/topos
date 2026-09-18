import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/primitives/alert-dialog";
import { Label } from "@/shared/ui/primitives/label";
import { isPreview, previewNoticeDismissedKey } from "@/shared/config/preview";
import { useCurrentUser } from "@/entities/session";

interface PreviewNoticeDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: "auth" | "landing";
}

export const PreviewNoticeDialog = ({ open, onOpenChange, trigger }: PreviewNoticeDialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const isControlled = open !== undefined && onOpenChange !== undefined;
  const dialogOpen = isControlled ? open! : internalOpen;
  const setDialogOpen = isControlled ? onOpenChange! : setInternalOpen;
  const { user } = useCurrentUser();
  const storageKey = previewNoticeDismissedKey(user?.id ?? null);

  useEffect(() => {
    setDontShowAgain(false);
  }, [user?.id]);

  useEffect(() => {
    if (!isPreview()) return;
    if (isControlled) return;
    const dismissed = (() => {
      try {
        return localStorage.getItem(storageKey) === "true";
      } catch {
        return false;
      }
    })();
    if (dismissed) return;
    const timer = setTimeout(() => setInternalOpen(true), trigger === "landing" ? 600 : 200);
    return () => clearTimeout(timer);
  }, [isControlled, trigger, storageKey]);

  const handleOpenChange = (next: boolean) => {
    if (!next && dontShowAgain) {
      try {
        localStorage.setItem(storageKey, "true");
      } catch {
        // ignore
      }
    }
    setDialogOpen(next);
  };

  if (!isPreview()) return null;

  return (
    <AlertDialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <AlertDialogContent size="default" className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Preview mode</AlertDialogTitle>
          <AlertDialogDescription className="text-left">
            You&apos;re viewing a fully mocked Topos. All data lives in this browser (IndexedDB) — no backend required.
            <br />
            <br />
            <span className="font-medium text-foreground">Auth:</span> use any email and any password. If the email doesn&apos;t exist, a demo account is created automatically. Normal signup also works and writes to the local store.
            <br />
            <br />
            <span className="font-medium text-foreground">Limited in preview:</span> image and video uploads are disabled (you&apos;ll see &quot;Not available in preview mode&quot; on hover) and replaced with picsum placeholders; AI summary, tags, and draft generation are simulated locally.
            <br />
            <br />
            Everything else — posts, likes, saves, search, drafts, review, profile edits (text only) — works end-to-end. Clearing site data or logging in with a different email gives you a fresh workspace.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-center gap-2 py-2">
          <input
            id="preview-dont-show"
            type="checkbox"
            className="h-4 w-4 rounded-none border border-outline-variant/20 bg-surface-lowest"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
          />
          <Label htmlFor="preview-dont-show" className="text-sm font-normal">
            Don&apos;t show again
          </Label>
        </div>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => handleOpenChange(false)}>Continue in preview</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
