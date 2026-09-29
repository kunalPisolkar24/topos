import type React from "react";
import { Sparkles, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/shared/ui/primitives/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/ui/primitives/alert-dialog";

interface AISummaryDialogProps {
  summary: string | null | undefined;
  summaryStatus?: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AISummaryDialog: React.FC<AISummaryDialogProps> = ({
  summary,
  summaryStatus,
  isOpen,
  onOpenChange,
}) => {
  const renderContent = () => {
    if (summary && (summaryStatus === "COMPLETED" || (!summaryStatus && summary))) {
      return (
        <div className="bg-surface-low p-4 ring-1 ring-outline-variant/20">
          <p className="font-mono text-[0.625rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">Summary</p>
          <p className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-7 text-foreground">
            {summary}
          </p>
        </div>
      );
    }

    if (summaryStatus === "PENDING") {
      return (
        <div className="flex items-start gap-3 bg-surface-low p-4 ring-1 ring-outline-variant/20">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-mono text-[0.625rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">Status</p>
            <h3 className="mt-2 break-words font-sans text-sm font-semibold leading-5 tracking-[-0.015em] text-foreground">
              Summary in Progress
            </h3>
            <p className="mt-1 break-words font-sans text-xs leading-6 text-muted-foreground">
              The AI summary is being generated. Please check back in a few moments.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-start gap-3 bg-surface-low p-4 ring-1 ring-outline-variant/20">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-mono text-[0.625rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">Status</p>
          <h3 className="mt-2 break-words font-sans text-sm font-semibold leading-5 tracking-[-0.015em] text-foreground">
            Summary Unavailable
          </h3>
          <p className="mt-1 break-words font-sans text-xs leading-6 text-muted-foreground">
            The AI summary for this post is not available.
          </p>
        </div>
      </div>
    );
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          className="w-full sm:w-auto"
        >
          <Sparkles size={16} />
          View AI Summary
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="flex max-h-[85vh] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden bg-surface-lowest p-0 ring-outline-variant/20 sm:max-w-lg">
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <AlertDialogHeader className="place-items-start text-left">
            <AlertDialogMedia className="mb-0 rounded-none bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </AlertDialogMedia>
            <AlertDialogTitle className="text-left font-sans text-[1.0625rem] font-semibold tracking-[-0.02em]">AI-Generated Summary</AlertDialogTitle>
            <AlertDialogDescription className="text-left font-sans leading-6">
              AI-generated summary for this post. Use Close to dismiss.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="mt-4">{renderContent()}</div>
        </div>
        <AlertDialogFooter className="mx-0 mb-0 shrink-0 border-outline-variant/20 bg-surface-low">
          <AlertDialogCancel className="w-full sm:w-auto">Close</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
