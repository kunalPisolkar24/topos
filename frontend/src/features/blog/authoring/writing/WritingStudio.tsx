import type React from "react";
import { ListOrdered, PenLine, Sparkles } from "lucide-react";
import { Button } from "@/shared/ui/primitives/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/ui/primitives/card";
import { Input } from "@/shared/ui/primitives/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/primitives/select";
import { Textarea } from "@/shared/ui/primitives/textarea";
import type { UseWritingStudioResult } from "./useWritingStudio";
import {
  WRITING_AUDIENCES,
  WRITING_LENGTHS,
  WRITING_STRUCTURES,
  WRITING_TONES,
} from "./types";

interface WritingStudioProps {
  studio: UseWritingStudioResult;
}

const fieldLabelClassName =
  "font-mono text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-muted-foreground";

interface StudioSelectProps<T extends string> {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}

const formatOptionLabel = (value: string) =>
  value
    .split(/[-_]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

function StudioSelect<T extends string>({
  label,
  options,
  value,
  onChange,
}: StudioSelectProps<T>) {
  return (
    <div className="space-y-2">
      <span className={fieldLabelClassName}>{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {formatOptionLabel(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const steps = ["brief", "draft"] as const;

export const WritingStudio: React.FC<WritingStudioProps> = ({ studio }) => {
  const {
    brief,
    step,
    sections,
    isGenerating,
    canGenerate,
    canApply,
  } = studio;

  return (
    <Card className="gap-0 bg-surface-lowest py-0">
      <CardHeader className="bg-primary-container p-4 text-primary-foreground sm:p-5">
        <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-primary-foreground/80">
          03 // Guided Studio
        </p>
        <CardTitle className="mt-2 flex items-center gap-2 text-xl font-semibold tracking-[-0.04em]">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
          Write with outline control
        </CardTitle>
        <p className="max-w-2xl text-sm leading-6 text-primary-foreground/70">
          Pick a style, generate a full draft, rearrange its sections, then
          apply it to the editor.
        </p>
      </CardHeader>
      <CardContent className="space-y-5 p-4 sm:p-5">
        <ol className="flex items-center gap-2">
          {steps.map((item) => (
            <li
              key={item}
              aria-current={step === item ? "step" : undefined}
              className={`px-2 py-1 font-mono text-[0.6875rem] uppercase tracking-[0.18em] ${
                step === item
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-low text-muted-foreground"
              }`}
            >
              {item}
            </li>
          ))}
        </ol>

        {step === "brief" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="studioTopic" className={fieldLabelClassName}>
                Topic
              </label>
              <Textarea
                id="studioTopic"
                value={brief.topic}
                onChange={(event) =>
                  studio.setBriefField("topic", event.target.value)
                }
                placeholder="What is this post about? Include reader and angle..."
                className="min-h-24 resize-y bg-surface-lowest leading-7"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="studioPoints" className={fieldLabelClassName}>
                Key points (optional, one per line)
              </label>
              <Textarea
                id="studioPoints"
                value={brief.keyPoints}
                onChange={(event) =>
                  studio.setBriefField("keyPoints", event.target.value)
                }
                placeholder={"First insight\nSecond insight\nTrade-off to cover"}
                className="min-h-20 max-h-64 resize-y overflow-auto bg-surface-lowest leading-7"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <StudioSelect
                label="Audience"
                options={WRITING_AUDIENCES}
                value={brief.audience}
                onChange={(value) => studio.setBriefField("audience", value)}
              />
              <StudioSelect
                label="Tone"
                options={WRITING_TONES}
                value={brief.tone}
                onChange={(value) => studio.setBriefField("tone", value)}
              />
              <StudioSelect
                label="Length"
                options={WRITING_LENGTHS}
                value={brief.length}
                onChange={(value) => studio.setBriefField("length", value)}
              />
              <StudioSelect
                label="Structure"
                options={WRITING_STRUCTURES}
                value={brief.structure}
                onChange={(value) => studio.setBriefField("structure", value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="studioKeywords" className={fieldLabelClassName}>
                Keywords (optional, comma separated)
              </label>
              <Input
                id="studioKeywords"
                value={brief.keywords}
                onChange={(event) =>
                  studio.setBriefField("keywords", event.target.value)
                }
                placeholder="postgres, indexing, latency"
              />
            </div>
            <Button
              type="button"
              onClick={() => void studio.generate()}
              disabled={!canGenerate}
            >
              {isGenerating ? "Generating draft..." : "Generate draft"}
            </Button>
          </div>
        )}

        {step === "draft" && (
          <div className="space-y-4">
            <p className="flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">
              <ListOrdered className="h-4 w-4" aria-hidden="true" />
              Draft ({sections.length} sections)
            </p>
            <div className="space-y-3">
              {sections.map((section, index) => (
                <div
                  key={section.id}
                  className="space-y-2 bg-surface-low p-3 ring-1 ring-outline-variant/20"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {index + 1}
                    </span>
                    <Input
                      aria-label={`Section ${index + 1} heading`}
                      value={section.heading}
                      placeholder="Introduction (no heading)"
                      onChange={(event) =>
                        studio.updateSectionHeading(
                          section.id,
                          event.target.value,
                        )
                      }
                    />
                  </div>
                  {section.heading && (
                    <p className="text-sm font-medium leading-7 text-foreground">
                      {section.heading}
                    </p>
                  )}
                  <div
                    className="bg-surface-lowest p-3 text-sm leading-7"
                    dangerouslySetInnerHTML={{ __html: section.bodyHtml }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => studio.moveSection(section.id, -1)}
                      disabled={index === 0}
                    >
                      Move up
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => studio.moveSection(section.id, 1)}
                      disabled={index === sections.length - 1}
                    >
                      Move down
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      onClick={() => studio.removeSection(section.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                onClick={studio.applyToEditor}
                disabled={!canApply}
              >
                <PenLine className="h-4 w-4" aria-hidden="true" />
                Apply to editor
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={studio.reset}
                disabled={isGenerating}
              >
                Start over
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
