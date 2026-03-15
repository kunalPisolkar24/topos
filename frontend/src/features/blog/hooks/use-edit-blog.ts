import { useState, useCallback } from "react";
import { useMutation } from "@apollo/client/react";
import { UpdatePostDocument, type UpdatePostInput } from "@/graphql/content-documents";
import { updatePostSchema, type UpdatePostFormValues } from "@/schemas/blog/post.schema";
import { useToast } from "@/hooks/use-toast";
import { useImageUpload } from "@/hooks/use-image-upload";
import { getGraphQLErrorMessage } from "@/lib/apollo/error-message";
import { z } from "zod";

export const useEditBlog = (blog: any, onComplete: () => void) => {
  const { toast } = useToast();
  const [editTitle, setEditTitle] = useState(blog?.title || "");
  const [editContent, setEditContent] = useState(blog?.body || "");
  const [editTags, setEditTags] = useState<string[]>(blog?.tags.map((t: any) => t.name) || []);
  const [editNewTag, setEditNewTag] = useState("");
  const [editCardImage, setEditCardImage] = useState<File | null>(null);
  const [editCardImageUrl, setEditCardImageUrl] = useState<string | null>(blog?.imageUrl || null);
  const [editCardImagePreview, setEditCardImagePreview] = useState<string | null>(blog?.imageUrl || null);

  const { upload: uploadCardImage, isUploading: isUploadingCardImage } = useImageUpload();
  const [updatePost, { loading: isUpdating }] = useMutation(UpdatePostDocument);

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
    }
  };

  const handleRemoveTag = (tag: string) => {
    setEditTags(editTags.filter((t) => t !== tag));
  };

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
      isUpdating,
    },
    setters: {
      setEditTitle,
      setEditContent,
      setEditTags,
      setEditNewTag,
      setEditCardImageUrl,
      setEditCardImagePreview,
    },
    handlers: {
      handleCardImageChange,
      handleUpdate,
      handleAddTag,
      handleRemoveTag,
    }
  };
};
