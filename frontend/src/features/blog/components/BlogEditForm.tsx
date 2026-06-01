import type React from "react";
import { useRef } from "react";
import { CheckCircle2, Circle, FileText, ImageIcon, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BlogEditor,
  BlogTitleSection,
  FeaturedImageSection,
  BlogTagSection,
  usePostAuthoringController,
  type PostForEditing,
} from "@/features/blog";

interface BlogEditFormProps {
  blog: PostForEditing;
  onCancel: () => void;
  onComplete: () => void;
}

export const BlogEditForm: React.FC<BlogEditFormProps> = ({
  blog,
  onCancel,
  onComplete,
}) => {
  const { state, setters, handlers, refs } = usePostAuthoringController({
    mode: "edit",
    post: blog,
    onComplete,
  });
  const cardImageInputRef = useRef<HTMLInputElement>(null);

  const { contentText } = state;
  const titleReady = state.title.trim().length > 0;
  const contentReady = contentText.length > 0;
  const imageReady = Boolean(
    state.cardImage || state.cardImageUrl || state.cardImagePreview,
  );

  return (
    <form
      onSubmit={handlers.handleSubmit}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_384px]"
    >
      <div className="space-y-6">
        <BlogTitleSection
          value={state.title}
          onChange={setters.setTitle}
        />

        <FeaturedImageSection
          preview={state.cardImagePreview}
          cardImage={state.cardImage}
          cardImageUrl={state.cardImageUrl}
          isUploading={state.isUploadingCardImage}
          onFileChange={handlers.handleCardImageChange}
          inputRef={cardImageInputRef}
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
      </div>

      <aside className="lg:sticky lg:top-app-navbar-offset lg:self-start">
        <div className="bg-surface-low p-4 ring-1 ring-outline-variant/20 sm:p-5">
          <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-primary">
            Revision Stack
          </p>
          <div className="mt-5 space-y-2">
            <PublishChecklistItem
              icon={FileText}
              label="Title"
              detail={titleReady ? "Ready" : "Required"}
              complete={titleReady}
            />
            <PublishChecklistItem
              icon={ImageIcon}
              label="Cover"
              detail={imageReady ? "Selected" : "Required"}
              complete={imageReady}
            />
            <PublishChecklistItem
              icon={FileText}
              label="Body"
              detail={contentReady ? `${contentText.length} chars` : "Required"}
              complete={contentReady}
            />
            <PublishChecklistItem
              icon={Tags}
              label="Tags"
              detail={`${state.tags.length} added`}
              complete={state.tags.length > 0}
            />
          </div>

          <div className="mt-5 bg-surface-lowest p-4 ring-1 ring-outline-variant/20">
            <p className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted-foreground">
              Revision Rule
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              All post fields are validated prior to save. Changes are instantly published.
            </p>
          </div>

          <div className="mt-5 grid gap-3">
            <Button
              type="submit"
              disabled={state.isSubmitting}
              className="w-full"
            >
              {state.submitLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </div>
      </aside>
    </form>
  );
};

interface PublishChecklistItemProps {
  icon: React.ElementType;
  label: string;
  detail: string;
  complete: boolean;
}

const PublishChecklistItem: React.FC<PublishChecklistItemProps> = ({
  icon: Icon,
  label,
  detail,
  complete,
}) => (
  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 bg-surface-lowest p-3 ring-1 ring-outline-variant/20">
    <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
    <div className="min-w-0">
      <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-foreground">
        {label}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
    {complete ? (
      <CheckCircle2 className="h-4 w-4 text-primary" aria-label="Complete" />
    ) : (
      <Circle className="h-4 w-4 text-muted-foreground" aria-label="Incomplete" />
    )}
  </div>
);
