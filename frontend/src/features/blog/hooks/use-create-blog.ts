import { useState, useRef, useMemo, useCallback } from "react";
import { useMutation } from "@apollo/client/react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import type ReactQuill from "react-quill";
import {
  CreatePostDocument,
  GeneratePostContentDocument,
  GenerateTagsDocument,
} from "@/graphql/content-documents";
import { getGraphQLErrorMessage } from "@/shared/api";
import { createPostSchema } from "@/schemas/blog/post.schema";
import { useToast } from "@/hooks/use-toast";
import { useImageUpload } from "@/hooks/use-image-upload";

const MIN_TAG_TITLE_LENGTH = 5;
const MIN_TAG_BODY_LENGTH = 80;
const MIN_PROMPT_LENGTH = 30;

const toPlainText = (value: string) =>
  value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeTags = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

export const useCreateBlog = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [cardImage, setCardImage] = useState<File | null>(null);
  const [cardImageUrl, setCardImageUrl] = useState<string | null>(null);
  const [cardImagePreview, setCardImagePreview] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [postPrompt, setPostPrompt] = useState("");
  const [generatedSummary, setGeneratedSummary] = useState<string | null>(null);
  const [isSummaryVisible, setIsSummaryVisible] = useState(false);

  const quillRef = useRef<ReactQuill>(null);
  const cardImageInputRef = useRef<HTMLInputElement>(null);

  const [createPost, { loading: isCreatingPost }] = useMutation(CreatePostDocument, {
    refetchQueries: ["Posts", "PostsByTag", "MyPosts", "SearchPosts"],
  });
  const [generateTags, { loading: isGeneratingTags }] = useMutation(GenerateTagsDocument);
  const [generatePostContent, { loading: isGeneratingPost }] = useMutation(GeneratePostContentDocument);

  const { upload: uploadCardImage, isUploading: isUploadingCardImage } = useImageUpload();
  const { upload: uploadRichTextImage, isUploading: isUploadingRichText } = useImageUpload();

  const handleCardImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setCardImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCardImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setCardImageUrl(null);
    }
  };

  const uploadCardImageToCloudinary = async () => {
    if (!cardImage) {
      toast({
        title: "No Card Image",
        description: "Please select an image for the blog card.",
        variant: "destructive",
      });
      return null;
    }

    const secureUrl = await uploadCardImage(cardImage, {
      loadingTitle: "Uploading Card Image...",
      successTitle: "Card Image Uploaded",
      errorTitle: "Card Image Upload Failed",
    });

    if (secureUrl) {
      setCardImageUrl(secureUrl);
    }
    
    return secureUrl;
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

  const contentText = useMemo(() => toPlainText(content), [content]);

  const canGenerateTags = title.trim().length >= MIN_TAG_TITLE_LENGTH && contentText.length >= MIN_TAG_BODY_LENGTH;
  const canGeneratePost = postPrompt.trim().length >= MIN_PROMPT_LENGTH;

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
          title: title.trim(),
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

      setTags(normalizeTags([...tags, ...generated]));
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

  const handleGeneratePost = async () => {
    if (!canGeneratePost) {
      toast({
        title: "Prompt Too Short",
        description: "Provide a longer prompt to generate a full draft.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data } = await generatePostContent({
        variables: { prompt: postPrompt.trim() },
      });

      const generated = data?.generatePostContent;
      if (!generated?.title || !generated?.body) {
        toast({
          title: "Incomplete Draft",
          description: "The generated draft is missing required content.",
          variant: "destructive",
        });
        return;
      }

      setTitle(generated.title);
      setContent(generated.body);
      setTags(normalizeTags(generated.tags ?? []));
      setGeneratedSummary(generated.summary ?? null);
      setIsSummaryVisible(false);
      toast({
        title: "Draft Generated",
        description: "Title, content, and tags have been updated.",
      });
    } catch (error) {
      toast({
        title: "Post Generation Failed",
        description: getGraphQLErrorMessage(error, "Unable to generate a draft right now."),
        variant: "destructive",
      });
    }
  };

  const handleAddTag = () => {
    const trimmed = newTag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setNewTag("");
      setIsDialogOpen(false);
    } else if (!trimmed) {
      toast({ title: "Empty Tag", description: "Tag cannot be empty.", variant: "destructive" });
    } else {
      toast({ title: "Duplicate Tag", description: "This tag has already been added.", variant: "destructive" });
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedTitle = title.trim();
    const trimmedBody = contentText;

    if (!trimmedTitle || !trimmedBody) {
      toast({
        title: "Missing Information",
        description: "Title and content are required.",
        variant: "destructive",
      });
      return;
    }

    let finalCardImageUrl = cardImageUrl;
    if (cardImage && !finalCardImageUrl) {
      finalCardImageUrl = await uploadCardImageToCloudinary();
      if (!finalCardImageUrl) return;
    }

    if (!finalCardImageUrl) {
      toast({
        title: "Missing Card Image",
        description: "Please upload a card image for the blog.",
        variant: "destructive",
      });
      return;
    }

    const blogData = {
      title: trimmedTitle,
      body: content,
      summary: generatedSummary?.trim() || undefined,
      tags,
      imageUrl: finalCardImageUrl,
    };

    try {
      const parsedData = createPostSchema.parse(blogData);
      await createPost({ variables: { input: parsedData } });
      toast({ title: "Blog Created", description: "Successfully created." });
      navigate("/");
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.issues.forEach((issue) => {
          toast({
            title: "Validation Error",
            description: `${issue.path.join(".")} - ${issue.message}`,
            variant: "destructive",
          });
        });
        return;
      }
      toast({
        title: "Error",
        description: getGraphQLErrorMessage(error, "Failed to create blog post."),
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    toast({ title: "Action Cancelled", description: "Blog creation cancelled." });
    navigate("/");
  };

  return {
    state: {
      title,
      content,
      cardImage,
      cardImageUrl,
      cardImagePreview,
      isUploadingCardImage,
      isUploadingRichText,
      tags,
      newTag,
      isDialogOpen,
      postPrompt,
      generatedSummary,
      isSummaryVisible,
      isCreatingPost,
      isGeneratingTags,
      isGeneratingPost,
      canGenerateTags,
      canGeneratePost,
    },
    setters: {
      setTitle,
      setContent,
      setNewTag,
      setIsDialogOpen,
      setPostPrompt,
      setGeneratedSummary,
      setIsSummaryVisible,
    },
    handlers: {
      handleCardImageChange,
      handleGenerateTags,
      handleGeneratePost,
      handleAddTag,
      handleRemoveTag,
      handleSubmit,
      handleCancel,
      richTextimageHandler,
    },
    refs: {
      quillRef,
      cardImageInputRef,
    }
  };
};
