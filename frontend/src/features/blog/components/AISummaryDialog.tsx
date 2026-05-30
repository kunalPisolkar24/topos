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
        <div className="max-h-[60vh] overflow-y-auto py-2 my-2 pr-3 -mr-1">
          <div className="bg-surface-lowest ring-1 ring-outline-variant/20 p-4">
            <p className="whitespace-pre-wrap text-base sm:text-lg text-justify leading-relaxed text-foreground">
              {summary}
            </p>
          </div>
        </div>
      );
    }

    if (summaryStatus === "PENDING") {
      return (
        <div className="py-4 my-2">
          <div className="bg-surface-lowest ring-1 ring-outline-variant/20 p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="text-base sm:text-lg font-medium text-foreground">
                Summary in Progress
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                The AI summary is being generated. Please check back in a few moments.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="py-4 my-2">
          <div className="bg-surface-lowest ring-1 ring-outline-variant/20 p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <h3 className="text-base sm:text-lg font-medium text-foreground">
                Summary Unavailable
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
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
          <Sparkles size={16} className="mr-2" />
          View AI Summary
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="w-[90vw] max-w-xl md:max-w-2xl">
        <AlertDialogHeader className="pb-1 pt-2 px-6">
          <AlertDialogTitle className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-muted-foreground shrink-0" />
            AI-Generated Summary
          </AlertDialogTitle>
        </AlertDialogHeader>
        <div className="pb-2 px-6">{renderContent()}</div>
        <AlertDialogFooter className="px-6 py-4">
          <AlertDialogCancel>Close</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
