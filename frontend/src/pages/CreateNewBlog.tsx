"use client";

import type React from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StickyNavbar } from "@/layouts";
import { 
  useCreateBlog,
  BlogEditor,
  BlogTitleSection,
  AIDraftGenerator,
  FeaturedImageSection,
  BlogTagSection,
} from "@/features/blog";

const CreateNewBlog: React.FC = () => {
  const { state, setters, handlers, refs } = useCreateBlog();

  return (
    <div className="min-h-screen bg-zinc-950">
      <StickyNavbar />
      <div className="container mx-auto px-4 mt-[70px] py-8">
        <div className="max-w-4xl mx-auto">
          <header className="mb-8">
            <h1 className="text-3xl lg:text-4xl font-bold text-zinc-100 mb-2 flex items-center">
              <Sparkles className="mr-3 h-8 w-8 text-zinc-400" />
              Create New Blog Post
            </h1>
            <p className="text-zinc-400">Share your thoughts and ideas with the world</p>
          </header>

          <form onSubmit={handlers.handleSubmit} className="space-y-8">
            <BlogTitleSection 
              value={state.title} 
              onChange={setters.setTitle} 
            />

            <AIDraftGenerator
              prompt={state.postPrompt}
              onPromptChange={setters.setPostPrompt}
              onGenerate={handlers.handleGeneratePost}
              isGenerating={state.isGeneratingPost}
              canGenerate={state.canGeneratePost}
              onClear={() => {
                setters.setPostPrompt("");
                setters.setGeneratedSummary(null);
                setters.setIsSummaryVisible(false);
              }}
              summary={state.generatedSummary}
              isSummaryVisible={state.isSummaryVisible}
              onToggleSummary={() => setters.setIsSummaryVisible(!state.isSummaryVisible)}
            />

            <FeaturedImageSection
              preview={state.cardImagePreview}
              cardImage={state.cardImage}
              cardImageUrl={state.cardImageUrl}
              isUploading={state.isUploadingCardImage}
              onFileChange={handlers.handleCardImageChange}
              inputRef={refs.cardImageInputRef}
            />

            <BlogEditor
              ref={refs.quillRef}
              value={state.content}
              onChange={setters.setContent}
              onImageUpload={handlers.richTextimageHandler}
            />

            <BlogTagSection
              tags={state.tags}
              onRemoveTag={handlers.handleRemoveTag}
              isDialogOpen={state.isDialogOpen}
              setIsDialogOpen={setters.setIsDialogOpen}
              newTag={state.newTag}
              setNewTag={setters.setNewTag}
              onAddTag={handlers.handleAddTag}
              onGenerateTags={handlers.handleGenerateTags}
              isGeneratingTags={state.isGeneratingTags}
              canGenerateTags={state.canGenerateTags}
            />

            <div className="flex flex-col sm:flex-row justify-end gap-4 pt-6 border-t border-zinc-800">
              <Button
                type="button"
                variant="outline"
                onClick={handlers.handleCancel}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={state.isUploadingCardImage || state.isCreatingPost}
                className="bg-zinc-300 hover:bg-zinc-400 text-zinc-900"
              >
                {state.isUploadingCardImage
                  ? "Uploading..."
                  : state.isCreatingPost
                    ? "Publishing..."
                    : "Publish Post"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateNewBlog;
