import { useState, useRef, useMemo, useCallback } from "react";
import { useMutation } from "@apollo/client/react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { z } from "zod";
import type ReactQuill from "react-quill";
import {
  CreatePostDocument,
  GeneratePostContentDocument,
  GenerateTagsDocument,
} from "@/graphql/content-documents";
import { getGraphQLErrorMessage } from "@/lib/apollo/error-message";
import { createPostSchema } from "@/schemas/blog/post.schema";
import { useToast } from "@/hooks/use-toast";

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
  const [isUploadingCardImage, setIsUploadingCardImage] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [postPrompt, setPostPrompt] = useState("");
  const [generatedSummary, setGeneratedSummary] = useState<string | null>(null);
  const [isSummaryVisible, setIsSummaryVisible] = useState(false);

  const quillRef = useRef<ReactQuill>(null);
  const cardImageInputRef = useRef<HTMLInputElement>(null);

  const [createPost, { loading: isCreatingPost }] = useMutation(CreatePostDocument);
  const [generateTags, { loading: isGeneratingTags }] = useMutation(GenerateTagsDocument);
  const [generatePostContent, { loading: isGeneratingPost }] = useMutation(GeneratePostContentDocument);

  const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`;
  const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

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
    if (!CLOUDINARY_URL || !CLOUDINARY_UPLOAD_PRESET) {
      toast({
        title: "Upload Error",
        description: "Cloudinary configuration missing.",
        variant: "destructive",
      });
      return null;
    }

    const formData = new FormData();
    formData.append("file", cardImage);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    setIsUploadingCardImage(true);
    try {
      toast({ title: "Uploading Card Image...", description: "Please wait." });
      const response = await axios.post(CLOUDINARY_URL, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setCardImageUrl(response.data.secure_url);
      toast({
        title: "Card Image Uploaded",
        description: "Successfully uploaded to Cloudinary.",
      });
      return response.data.secure_url;
    } catch (error) {
      toast({
        title: "Card Image Upload Failed",
        description: "Could not upload image.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsUploadingCardImage(false);
    }
  };

  const richTextimageHandler = useCallback(async () => {
    if (!CLOUDINARY_URL || !CLOUDINARY_UPLOAD_PRESET) {
      toast({
        title: "Image Upload Error",
        description: "Cloudinary configuration is missing.",
        variant: "destructive",
      });
      return;
    }
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();
    input.onchange = async () => {
      if (input.files && input.files.length > 0) {
        const file = input.files[0];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
        try {
          toast({ title: "Uploading Image...", description: "Please wait." });
          const response = await axios.post(CLOUDINARY_URL, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          const imageUrl = response.data.secure_url;
          const quill = quillRef.current?.getEditor();
          if (quill) {
            const range = quill.getSelection(true);
            quill.insertEmbed(range.index, "image", imageUrl);
            quill.setSelection(range.index + 1, 0);
          }
          toast({
            title: "Image Uploaded",
            description: "Successfully added to content.",
          });
        } catch (error) {
          toast({ title: "Image Upload Failed", variant: "destructive" });
        }
      }
    };
  }, [CLOUDINARY_URL, CLOUDINARY_UPLOAD_PRESET, toast]);

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
