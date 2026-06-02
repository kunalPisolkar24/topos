import type React from "react";
import { FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface BlogTitleSectionProps {
  value: string;
  onChange: (value: string) => void;
}

export const BlogTitleSection: React.FC<BlogTitleSectionProps> = ({ value, onChange }) => {
  return (
    <Card className="gap-0 bg-surface-lowest py-0">
      <CardHeader className="bg-surface-low p-4 sm:p-5">
        <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-primary">
          01 // Title
        </p>
        <CardTitle className="mt-2 flex items-center gap-2 text-xl font-semibold tracking-[-0.04em] text-foreground">
          <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
          Editorial Heading
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-5">
        <label
          htmlFor="blogTitle"
          className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-muted-foreground"
        >
          Public title
        </label>
        <Input
          id="blogTitle"
          type="text"
          placeholder="Write a clear, specific headline..."
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="blog-title-input mt-2 h-auto bg-surface-lowest px-4 py-4 text-2xl font-semibold leading-tight tracking-[-0.04em] placeholder:text-muted-foreground md:text-3xl"
          required
        />
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Make the promise explicit. Topos posts read best when the title is precise, not decorative.
        </p>
      </CardContent>
    </Card>
  );
};
