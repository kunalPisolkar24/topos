import type React from "react";
import { X, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles } from "lucide-react";
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
    <Card className="bg-zinc-900/20 border-zinc-800 shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-zinc-100 flex items-center">
          <Tag className="mr-2 h-5 w-5 text-zinc-400" />
          Tags
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4 min-h-[2.5rem]">
          {tags.length > 0 ? (
            tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="px-3 py-1.5 text-sm bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => onRemoveTag(tag)}
                  className="ml-2 text-zinc-400 hover:text-red-400 transition-colors"
                >
                  <X size={14} />
                </button>
              </Badge>
            ))
          ) : (
            <p className="text-sm text-zinc-500 py-2">No tags added yet.</p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                <Tag className="mr-2 h-4 w-4" />
                Add Tags
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-zinc-950 border-zinc-800">
              <DialogHeader>
                <DialogTitle className="text-zinc-100">Add a new tag</DialogTitle>
                <DialogDescription className="text-zinc-400">Enter a new tag for your post.</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Input
                  placeholder="Enter tag name"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  className="bg-zinc-900 border-zinc-700 text-zinc-100"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onAddTag())}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setNewTag("");
                  }}
                  className="border-zinc-700 text-zinc-300"
                >
                  Cancel
                </Button>
                <Button onClick={onAddTag} className="bg-zinc-300 hover:bg-zinc-400">
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
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {isGeneratingTags ? "Generating..." : "Generate Tags"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
