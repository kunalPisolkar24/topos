import type React from "react";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface AIDraftGeneratorProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  canGenerate: boolean;
  onClear: () => void;
  summary: string | null;
  isSummaryVisible: boolean;
  onToggleSummary: () => void;
}

export const AIDraftGenerator: React.FC<AIDraftGeneratorProps> = ({
  prompt,
  onPromptChange,
  onGenerate,
  isGenerating,
  canGenerate,
  onClear,
  summary,
  isSummaryVisible,
  onToggleSummary,
}) => {
  return (
    <Card className="bg-zinc-900/20 border-zinc-800 shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-zinc-100 flex items-center">
          <Sparkles className="mr-2 h-5 w-5 text-zinc-400" />
          AI Draft Generator
        </CardTitle>
        <p className="text-sm text-zinc-400">
          Generate a full draft from a prompt. Summary is saved but hidden by default.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Textarea
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="Describe the post you want to generate..."
            className="min-h-[120px] bg-zinc-900/40 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
          />
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              type="button"
              onClick={onGenerate}
              disabled={isGenerating || !canGenerate}
              className="bg-zinc-300 hover:bg-zinc-400 text-zinc-900"
            >
              {isGenerating ? "Generating..." : "Generate Draft"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClear}
              disabled={!prompt && !summary}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Clear Prompt
            </Button>
          </div>
          {summary && (
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                onClick={onToggleSummary}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                {isSummaryVisible ? "Hide Summary" : "View Summary"}
              </Button>
              {isSummaryVisible && (
                <div className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-4">
                  <p className="text-sm text-zinc-200 whitespace-pre-wrap">{summary}</p>
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-zinc-500">
            A longer prompt produces better results. Generating a draft will replace current content.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
