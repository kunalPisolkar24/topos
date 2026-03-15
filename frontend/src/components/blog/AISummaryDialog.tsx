import type React from "react";
import { Sparkles, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface AISummaryDialogProps {
  summary: string | null;
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
        <div className="max-h-[60vh] overflow-y-auto py-2 my-2 scrollbar-thin scrollbar-thumb-zinc-600 scrollbar-track-zinc-800 pr-3 -mr-1">
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
            <p className="whitespace-pre-wrap text-base sm:text-lg text-justify leading-relaxed text-zinc-200 selection:bg-zinc-600/30 prose">
              {summary}
            </p>
          </div>
        </div>
      );
    }

    if (summaryStatus === "PENDING") {
      return (
        <div className="py-4 my-2">
          <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-4 flex items-center">
            <Clock className="mr-3 h-5 w-5 text-amber-400 animate-pulse" />
            <div>
              <AlertDialogDescription className="text-base sm:text-lg text-amber-200 font-medium">
                Summary in Progress
              </AlertDialogDescription>
              <p className="text-sm text-amber-300/80 mt-1">
                The AI summary is being generated. Please check back in a few moments.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="py-4 my-2">
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 flex items-center">
          <AlertCircle className="mr-3 h-5 w-5 text-zinc-400" />
          <div>
            <AlertDialogDescription className="text-base sm:text-lg text-zinc-300 font-medium">
              Summary Unavailable
            </AlertDialogDescription>
            <p className="text-sm text-zinc-400 mt-1">
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
          className="w-full sm:w-auto bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-all duration-200"
        >
          <Sparkles size={16} className="mr-2" />
          View AI Summary
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="w-[90vw] max-w-xl md:max-w-2xl bg-zinc-950 border-zinc-800 text-zinc-100 rounded-xl shadow-2xl">
        <AlertDialogHeader className="pb-1 pt-2 px-6">
          <AlertDialogTitle className="text-xl sm:text-2xl font-semibold text-zinc-100 flex items-center prose">
            <Sparkles className="mr-2 h-5 w-5 text-zinc-400" />
            AI-Generated Summary
          </AlertDialogTitle>
        </AlertDialogHeader>
        <div className="pb-2 px-6">{renderContent()}</div>
        <AlertDialogFooter className="px-6 py-4 border-t border-zinc-800">
          <AlertDialogCancel className="w-full sm:w-auto bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700">
            Close
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
