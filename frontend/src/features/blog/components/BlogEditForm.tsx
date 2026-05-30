import type React from "react";
import { UploadCloud, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BlogEditor } from "./BlogEditor";
import { useEditBlog } from "@/features/blog/hooks/use-edit-blog";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface BlogEditFormProps {
  blog: any;
  onCancel: () => void;
  onComplete: () => void;
}

export const BlogEditForm: React.FC<BlogEditFormProps> = ({
  blog,
  onCancel,
  onComplete,
}) => {
  const { state, setters, handlers } = useEditBlog(blog, onComplete);

  return (
    <form
      onSubmit={handlers.handleUpdate}
      className="space-y-8 bg-surface-lowest ring-1 ring-outline-variant/20 p-6 sm:p-8"
    >
      <div>
        <label htmlFor="editBlogTitle" className="block text-sm font-medium text-foreground mb-2">
          Edit Title
        </label>
        <Input
          id="editBlogTitle"
          type="text"
          placeholder="Enter title for the blog"
          value={state.editTitle}
          onChange={(e) => setters.setEditTitle(e.target.value)}
          className="text-2xl font-bold h-auto py-4"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Blog Card Image
        </label>
        <div
          className="mt-1 flex justify-center items-center px-6 pt-5 pb-6 border-2 border-dashed border-outline-variant/20 bg-surface-low hover:bg-surface-high transition-colors cursor-pointer h-60"
          onClick={() => document.getElementById("editCardImageUpload")?.click()}
        >
          <div className="space-y-1 text-center">
            {state.editCardImagePreview ? (
              <img
                src={state.editCardImagePreview}
                alt="Card preview"
                className="mx-auto h-40 object-contain"
              />
            ) : (
              <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground" />
            )}
            <div className="text-sm text-muted-foreground">
              <span className="relative font-medium text-foreground hover:text-foreground/80">
                {state.editCardImage ? "Change image" : state.editCardImageUrl ? "Change image" : "Upload an image"}
              </span>
              <input
                id="editCardImageUpload"
                type="file"
                className="sr-only"
                accept="image/*"
                onChange={handlers.handleCardImageChange}
              />
            </div>
            {state.editCardImage && (
              <p className="text-xs text-muted-foreground mt-1">{state.editCardImage.name}</p>
            )}
          </div>
        </div>
        {state.isUploadingCardImage && (
          <p className="text-sm text-muted-foreground mt-2">Uploading card image...</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Edit Content
        </label>
        <BlogEditor
          value={state.editContent}
          onChange={setters.setEditContent}
          placeholder="Write your masterpiece here..."
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">Edit Tags</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {state.editTags.map((tag) => (
            <Badge key={tag} variant="secondary" className="px-3 py-1">
              {tag}
              <button type="button" onClick={() => handlers.handleRemoveTag(tag)} className="ml-2 text-xs hover:text-destructive">
                <X size={12} />
              </button>
            </Badge>
          ))}
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              Add Tag
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Tag</DialogTitle>
              <DialogDescription>Enter the tag name.</DialogDescription>
            </DialogHeader>
            <Input
              placeholder="Enter tag name"
              value={state.editNewTag}
              onChange={(e) => setters.setEditNewTag(e.target.value)}
              className="mb-4"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handlers.handleAddTag())}
            />
            <DialogFooter>
              <Button type="button" onClick={handlers.handleAddTag}>Add</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={state.isUploadingCardImage || state.isUpdating}
        >
          {state.isUpdating ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
};
