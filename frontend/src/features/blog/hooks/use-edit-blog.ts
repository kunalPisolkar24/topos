import { useState, useRef, useCallback } from "react";
import { useMutation } from "@apollo/client/react";
import { UpdatePostDocument, GenerateTagsDocument, type UpdatePostInput } from "@/shared/graphql/content-documents";
import { updatePostSchema, type UpdatePostFormValues } from "@/schemas/blog/post.schema";
import { useToast } from "@/hooks/use-toast";
import { useImageUpload } from "@/hooks/use-image-upload";
import { getGraphQLErrorMessage } from "@/shared/api";
import { z } from "zod";
import type ReactQuill from "react-quill";

const MIN_TAG_TITLE_LENGTH = 5;
const MIN_TAG_BODY_LENGTH = 80;

const toPlainText = (value: string) =>
  value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeTags = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

export const useEditBlog = (blog: any, onComplete: () => void) => {
  const { toast } = useToast();
  const [editTitle, setEditTitle] = useState(blog?.title || "");
  const [editContent, setEditContent] = useState(blog?.body || "");
  const [editTags, setEditTags] = useState<string[]>(blog?.tags.map((t: any) => t.name) || []);
  const [editNewTag, setEditNewTag] = useState("");
  const [editCardImage, setEditCardImage] = useState<File | null>(null);
  const [editCardImageUrl, setEditCardImageUrl] = useState<string | null>(blog?.imageUrl || null);
  const [editCardImagePreview, setEditCardImagePreview] = useState<string | null>(blog?.imageUrl || null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const quillRef = useRef<ReactQuill>(null);

  const { upload: uploadCardImage, isUploading: isUploadingCardImage } = useImageUpload();
  const { upload: uploadRichTextImage, isUploading: isUploadingRichText } = useImageUpload();

  const [updatePost, { loading: isUpdating }] = useMutation(UpdatePostDocument, {
    refetchQueries: ["Posts", "PostsByTag", "MyPosts", "SearchPosts"],
  });
  const [generateTags, { loading: isGeneratingTags }] = useMutation(GenerateTagsDocument);

  const contentText = toPlainText(editContent);
  const canGenerateTags = editTitle.trim().length >= MIN_TAG_TITLE_LENGTH && contentText.length >= MIN_TAG_BODY_LENGTH;

  const handleCardImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setEditCardImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setEditCardImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blog) return;

    let finalImageUrl = editCardImageUrl;
    if (editCardImage) {
      const uploadedUrl = await uploadCardImage(editCardImage, {
        loadingTitle: "Uploading featured image...",
        successTitle: "Image uploaded",
      });
      if (!uploadedUrl) return;
      finalImageUrl = uploadedUrl;
    }

    try {
      const updateData: Partial<UpdatePostFormValues> = {};
      if (editTitle !== blog.title) updateData.title = editTitle;
      if (editContent !== blog.body) updateData.body = editContent;
      if (JSON.stringify(editTags) !== JSON.stringify(blog.tags.map((t: any) => t.name))) {
        updateData.tags = editTags;
      }
      if (finalImageUrl !== blog.imageUrl) updateData.imageUrl = finalImageUrl;

      if (Object.keys(updateData).length === 0) {
        toast({ title: "No Changes", description: "No changes detected." });
        onComplete();
        return;
      }

      const parsedInput = updatePostSchema.parse(updateData) as UpdatePostInput;
      await updatePost({ variables: { id: blog.id, input: parsedInput } });
      
      toast({ title: "Success", description: "Post updated successfully." });
      onComplete();
    } catch (err) {
      if (err instanceof z.ZodError) {
        err.issues.forEach((issue) => {
          toast({
            title: "Validation Error",
            description: `${issue.path.join(".")} - ${issue.message}`,
            variant: "destructive",
          });
        });
        return;
      }
      toast({
        title: "Update Failed",
        description: getGraphQLErrorMessage(err, "Could not update post."),
        variant: "destructive",
      });
    }
  };

  const handleAddTag = () => {
    const trimmed = editNewTag.trim();
    if (trimmed && !editTags.includes(trimmed)) {
      setEditTags([...editTags, trimmed]);
      setEditNewTag("");
      setIsDialogOpen(false);
    } else if (!trimmed) {
      toast({ title: "Empty Tag", description: "Tag cannot be empty.", variant: "destructive" });
    } else {
      toast({ title: "Duplicate Tag", description: "This tag has already been added.", variant: "destructive" });
    }
  };

  const handleRemoveTag = (tag: string) => {
    setEditTags(editTags.filter((t) => t !== tag));
  };

  const handleGenerateTags = async () => {
    if (!canGenerateTags) {
      toast({
        title: "Not Enough Content",
        description: "Add a longer title and more content before generating tags.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data } = await generateTags({
        variables: {
          title: editTitle.trim(),
          body: contentText,
        },
      });

      const generated = normalizeTags(data?.generateTags ?? []);
      if (generated.length === 0) {
        toast({
          title: "No Tags Generated",
          description: "Try adding more context and generate again.",
          variant: "destructive",
        });
        return;
      }

      setEditTags(normalizeTags([...editTags, ...generated]));
      toast({
        title: "Tags Generated",
        description: `Added ${generated.length} tag${generated.length === 1 ? "" : "s"}.`,
      });
    } catch (error) {
      toast({
        title: "Tag Generation Failed",
        description: getGraphQLErrorMessage(error, "Unable to generate tags right now."),
        variant: "destructive",
      });
    }
  };

  const richTextimageHandler = useCallback(async () => {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();
    input.onchange = async () => {
      if (input.files && input.files.length > 0) {
        const file = input.files[0];
        const imageUrl = await uploadRichTextImage(file);
        
        if (imageUrl) {
          const quill = quillRef.current?.getEditor();
          if (quill) {
            const range = quill.getSelection(true);
            quill.insertEmbed(range.index, "image", imageUrl);
            quill.setSelection(range.index + 1, 0);
          }
        }
      }
    };
  }, [uploadRichTextImage]);

  return {
    state: {
      editTitle,
      editContent,
      editTags,
      editNewTag,
      editCardImage,
      editCardImageUrl,
      editCardImagePreview,
      isUploadingCardImage,
      isUploadingRichText,
      isUpdating,
      isDialogOpen,
      isGeneratingTags,
      canGenerateTags,
    },
    setters: {
      setEditTitle,
      setEditContent,
      setEditTags,
      setEditNewTag,
      setEditCardImageUrl,
      setEditCardImagePreview,
      setIsDialogOpen,
    },
    handlers: {
      handleCardImageChange,
      handleUpdate,
      handleAddTag,
      handleRemoveTag,
      handleGenerateTags,
      richTextimageHandler,
    },
    refs: {
      quillRef,
    }
  };
};
