import type React from "react";
import { UploadCloud, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BlogEditor } from "./BlogEditor";
import { useEditBlog } from "@/hooks/blog/use-edit-blog";
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
      className="space-y-8 bg-zinc-900/20 border border-zinc-800 p-6 rounded-xl shadow-lg"
    >
      <div>
        <label htmlFor="editBlogTitle" className="block text-lg font-medium text-zinc-300 mb-2">
          Edit Title
        </label>
        <Input
          id="editBlogTitle"
          type="text"
          placeholder="Enter title for the blog"
          value={state.editTitle}
          onChange={(e) => setters.setEditTitle(e.target.value)}
          className="text-2xl font-bold p-4 bg-zinc-800/20 border-zinc-900 text-zinc-100"
          required
        />
      </div>

      <div>
        <label className="block text-lg font-medium text-zinc-300 mb-2">
          Blog Card Image
        </label>
        <div
          className="mt-1 flex justify-center items-center px-6 pt-5 pb-6 border-2 border-dashed border-zinc-700 rounded-xl cursor-pointer h-60 bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
          onClick={() => document.getElementById("editCardImageUpload")?.click()}
        >
          <div className="space-y-1 text-center">
            {state.editCardImagePreview ? (
              <img
                src={state.editCardImagePreview}
                alt="Card preview"
                className="mx-auto h-40 object-contain rounded-md"
              />
            ) : (
              <UploadCloud className="mx-auto h-10 w-10 text-zinc-400" />
            )}
            <div className="text-sm text-zinc-400">
              <span className="relative rounded-md font-medium text-zinc-300 hover:text-zinc-100">
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
              <p className="text-xs text-zinc-400 mt-1">{state.editCardImage.name}</p>
            )}
          </div>
        </div>
        {state.isUploadingCardImage && (
          <p className="text-sm text-zinc-300 mt-2">Uploading card image...</p>
        )}
      </div>

      <div>
        <label className="block text-lg font-medium text-zinc-300 mb-2">
          Edit Content
        </label>
        <BlogEditor
          value={state.editContent}
          onChange={setters.setEditContent}
          placeholder="Write your masterpiece here..."
        />
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2 text-zinc-300">Edit Tags</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {state.editTags.map((tag) => (
            <Badge key={tag} variant="secondary" className="px-3 py-1 bg-zinc-800 text-zinc-300 border-zinc-700">
              {tag}
              <button type="button" onClick={() => handlers.handleRemoveTag(tag)} className="ml-2 text-xs hover:text-red-400">
                <X size={12} />
              </button>
            </Badge>
          ))}
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300">
              Add Tag
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-950 border-zinc-800">
            <DialogHeader>
              <DialogTitle className="text-zinc-100">Add Tag</DialogTitle>
              <DialogDescription className="text-zinc-400">Enter the tag name.</DialogDescription>
            </DialogHeader>
            <Input
              placeholder="Enter tag name"
              value={state.editNewTag}
              onChange={(e) => setters.setEditNewTag(e.target.value)}
              className="mb-4 bg-zinc-950 border-zinc-700 text-zinc-100"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handlers.handleAddTag())}
            />
            <DialogFooter>
              <Button type="button" onClick={handlers.handleAddTag}>Add</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex justify-end space-x-4">
        <Button type="button" variant="outline" onClick={onCancel} className="border-zinc-700 text-zinc-300">
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={state.isUploadingCardImage || state.isUpdating} 
          className="bg-zinc-50 text-zinc-950 hover:bg-zinc-200"
        >
          {state.isUpdating ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
};
