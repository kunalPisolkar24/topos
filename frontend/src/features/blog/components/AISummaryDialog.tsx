import type React from "react";
import { Sparkles, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
        <div className="-mr-1 my-2 max-h-[60vh] overflow-y-auto pr-3">
          <div className="bg-surface-low p-4 ring-1 ring-outline-variant/20">
            <p className="whitespace-pre-wrap text-sm leading-7 text-foreground sm:text-base">
              {summary}
            </p>
          </div>
        </div>
      );
    }

    if (summaryStatus === "PENDING") {
      return (
        <div className="my-2 py-2">
          <div className="flex items-center gap-3 bg-surface-low p-4 ring-1 ring-outline-variant/20">
            <Clock className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <h3 className="font-medium text-foreground">
                Summary in Progress
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                The AI summary is being generated. Please check back in a few moments.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="my-2 py-2">
        <div className="flex items-center gap-3 bg-surface-low p-4 ring-1 ring-outline-variant/20">
          <AlertCircle className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <h3 className="font-medium text-foreground">
              Summary Unavailable
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              The AI summary for this post is not available.
            </p>
          </div>
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
      <AlertDialogContent className="w-[90vw] max-w-xl bg-surface-lowest p-0 ring-outline-variant/20 md:max-w-2xl">
        <AlertDialogHeader className="items-start px-5 pt-5 text-left sm:px-6 sm:pt-6">
          <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-primary">
            AI Summary
          </p>
          <AlertDialogTitle className="flex items-center gap-2 text-xl font-semibold tracking-[-0.04em] sm:text-2xl">
            <Sparkles className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            AI-Generated Summary
          </AlertDialogTitle>
        </AlertDialogHeader>
        <div className="px-5 pb-2 sm:px-6">{renderContent()}</div>
        <AlertDialogFooter className="border-outline-variant/20 bg-surface-low px-5 py-4 sm:px-6">
          <AlertDialogCancel>Close</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
