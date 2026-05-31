import type React from "react";
import { Sparkles, Tag, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface BlogTagSectionProps {
  tags: string[];
  onRemoveTag: (tag: string) => void;
  isDialogOpen: boolean;
  setIsDialogOpen: (open: boolean) => void;
  newTag: string;
  setNewTag: (tag: string) => void;
  onAddTag: () => void;
  onGenerateTags: () => void;
  isGeneratingTags: boolean;
  canGenerateTags: boolean;
}

export const BlogTagSection: React.FC<BlogTagSectionProps> = ({
  tags,
  onRemoveTag,
  isDialogOpen,
  setIsDialogOpen,
  newTag,
  setNewTag,
  onAddTag,
  onGenerateTags,
  isGeneratingTags,
  canGenerateTags,
}) => {
  return (
    <Card className="gap-0 bg-surface-lowest py-0">
      <CardHeader className="bg-surface-low p-4 sm:p-5">
        <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-primary">
          05 // Metadata
        </p>
        <CardTitle className="mt-2 flex items-center gap-2 text-xl font-semibold tracking-[-0.04em] text-foreground">
          <Tag className="h-5 w-5 text-primary" aria-hidden="true" />
          Topic Tags
        </CardTitle>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Tags are discovery signals. Keep them specific and reusable.
        </p>
      </CardHeader>
      <CardContent className="p-4 sm:p-5">
        <div className="mb-4 flex min-h-12 flex-wrap gap-2 bg-surface-low p-3 ring-1 ring-outline-variant/20">
          {tags.length > 0 ? (
            tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="h-8 gap-2 bg-primary-container px-3 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-primary-foreground"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => onRemoveTag(tag)}
                  className="text-primary-foreground/70 transition-colors hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  aria-label={`Remove ${tag} tag`}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </Badge>
            ))
          ) : (
            <p className="py-2 text-sm text-muted-foreground">No tags added yet.</p>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Tag className="h-4 w-4" />
                Add Tags
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-surface-lowest ring-outline-variant/20 sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold tracking-[-0.04em] text-foreground">
                  Add a new tag
                </DialogTitle>
                <DialogDescription>
                  Enter a topic label for this post.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Input
                  placeholder="Enter tag name"
                  value={newTag}
                  onChange={(event) => setNewTag(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), onAddTag())}
                />
              </div>
              <DialogFooter className="border-outline-variant/20 bg-surface-low">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setNewTag("");
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={onAddTag}>
                  Add Tag
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button
            type="button"
            variant="outline"
            onClick={onGenerateTags}
            disabled={isGeneratingTags || !canGenerateTags}
          >
            <Sparkles className="h-4 w-4" />
            {isGeneratingTags ? "Generating..." : "Generate Tags"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
