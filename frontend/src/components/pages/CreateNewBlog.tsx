"use client";

import type React from "react";
import { useMemo } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import {
  X,
  UploadCloud,
  ImageIcon,
  FileText,
  Tag,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StickyNavbar } from "../layouts";
import { useCreateBlog } from "@/hooks/blog/use-create-blog";

const CreateNewBlog: React.FC = () => {
  const { state, setters, handlers, refs } = useCreateBlog();

  const quillModules = useMemo(
    () => ({
      toolbar: {
        container: [
          [{ header: [1, 2, 3, 4, 5, 6, false] }],
          ["bold", "italic", "underline", "strike"],
          [{ list: "ordered" }, { list: "bullet" }],
          [{ indent: "-1" }, { indent: "+1" }],
          [{ align: [] }],
          ["link", "image", "video"],
          ["blockquote", "code-block"],
          [{ color: [] }, { background: [] }],
          ["clean"],
        ],
        handlers: { image: handlers.richTextimageHandler },
      },
      clipboard: { matchVisual: false },
    }),
    [handlers.richTextimageHandler]
  );

  const quillFormats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "list",
    "bullet",
    "indent",
    "align",
    "link",
    "image",
    "video",
    "blockquote",
    "code-block",
    "color",
    "background",
  ];

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
            <Card className="bg-zinc-900/20 border-zinc-800 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="text-zinc-100 flex items-center">
                  <FileText className="mr-2 h-5 w-5 text-zinc-400" />
                  Blog Title
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  id="blogTitle"
                  type="text"
                  placeholder="Enter an engaging title for your blog post..."
                  value={state.title}
                  onChange={(e) => setters.setTitle(e.target.value)}
                  className="text-xl prose p-4 bg-zinc-800/20 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500"
                  required
                />
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/20 border-zinc-800 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="text-zinc-100 flex items-center">
                  <Sparkles className="mr-2 h-5 w-5 text-zinc-400" />
                  AI Draft Generator
                </CardTitle>
                <p className="text-sm text-zinc-400">
                  Generate a full draft from a prompt. Summary is saved but hidden by default.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Textarea
                    value={state.postPrompt}
                    onChange={(e) => setters.setPostPrompt(e.target.value)}
                    placeholder="Describe the post you want to generate..."
                    className="min-h-[120px] bg-zinc-900/40 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                  />
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      type="button"
                      onClick={handlers.handleGeneratePost}
                      disabled={state.isGeneratingPost || !state.canGeneratePost}
                      className="bg-zinc-300 hover:bg-zinc-400 text-zinc-900"
                    >
                      {state.isGeneratingPost ? "Generating..." : "Generate Draft"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setters.setPostPrompt("");
                        setters.setGeneratedSummary(null);
                        setters.setIsSummaryVisible(false);
                      }}
                      disabled={!state.postPrompt && !state.generatedSummary}
                      className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                    >
                      Clear Prompt
                    </Button>
                  </div>
                  {state.generatedSummary && (
                    <div className="space-y-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setters.setIsSummaryVisible(!state.isSummaryVisible)}
                        className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                      >
                        {state.isSummaryVisible ? "Hide Summary" : "View Summary"}
                      </Button>
                      {state.isSummaryVisible && (
                        <div className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-4">
                          <p className="text-sm text-zinc-200 whitespace-pre-wrap">{state.generatedSummary}</p>
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-zinc-500">
                    A longer prompt produces better results. Generating a draft will replace current content.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/20 border-zinc-800 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="text-zinc-100 flex items-center">
                  <ImageIcon className="mr-2 h-5 w-5 text-zinc-400" />
                  Featured Image
                </CardTitle>
                <p className="text-sm text-zinc-400">Recommended size: 600x400</p>
              </CardHeader>
              <CardContent>
                <div
                  className="flex justify-center items-center px-6 pt-5 pb-6 border-2 border-dashed border-zinc-700 rounded-xl cursor-pointer h-64 bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
                  onClick={() => refs.cardImageInputRef.current?.click()}
                >
                  <div className="space-y-2 text-center">
                    {state.cardImagePreview ? (
                      <img
                        src={state.cardImagePreview}
                        alt="Card preview"
                        className="mx-auto h-48 object-contain rounded-lg"
                      />
                    ) : (
                      <UploadCloud className="mx-auto h-12 w-12 text-zinc-400" />
                    )}
                    <div className="text-sm text-zinc-400">
                      <span className="font-medium text-zinc-300 hover:text-zinc-100 transition-colors">
                        {state.cardImage ? "Change image" : "Upload an image"}
                      </span>
                      <input
                        type="file"
                        className="sr-only"
                        accept="image/*"
                        ref={refs.cardImageInputRef}
                        onChange={handlers.handleCardImageChange}
                      />
                    </div>
                    {state.cardImage && <p className="text-xs text-zinc-400 mt-1">{state.cardImage.name}</p>}
                  </div>
                </div>
                {state.cardImageUrl && (
                  <div className="mt-3 p-3 bg-green-900/20 border border-green-800/50 rounded-lg">
                    <div className="text-sm text-green-300 flex items-center">
                      <ImageIcon size={16} className="mr-2" />
                      Image uploaded successfully
                    </div>
                  </div>
                )}
                {state.isUploadingCardImage && (
                  <div className="mt-3 p-3 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300">
                    Uploading card image...
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/20 border-zinc-800 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="text-zinc-100 flex items-center">
                  <FileText className="mr-2 h-5 w-5 text-zinc-400" />
                  Blog Content
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="blog-content-editor-wrapper rounded-lg overflow-hidden border border-zinc-700">
                  <ReactQuill
                    ref={refs.quillRef}
                    theme="snow"
                    value={state.content}
                    onChange={setters.setContent}
                    modules={quillModules}
                    formats={quillFormats}
                    placeholder="Write your masterpiece here..."
                    bounds=".blog-content-editor-wrapper"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/20 border-zinc-800 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="text-zinc-100 flex items-center">
                  <Tag className="mr-2 h-5 w-5 text-zinc-400" />
                  Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-4 min-h-[2.5rem]">
                  {state.tags.length > 0 ? (
                    state.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="px-3 py-1.5 text-sm bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handlers.handleRemoveTag(tag)}
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
                  <Dialog open={state.isDialogOpen} onOpenChange={setters.setIsDialogOpen}>
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
                          value={state.newTag}
                          onChange={(e) => setters.setNewTag(e.target.value)}
                          className="bg-zinc-900 border-zinc-700 text-zinc-100"
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handlers.handleAddTag())}
                        />
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setters.setIsDialogOpen(false);
                            setters.setNewTag("");
                          }}
                          className="border-zinc-700 text-zinc-300"
                        >
                          Cancel
                        </Button>
                        <Button onClick={handlers.handleAddTag} className="bg-zinc-300 hover:bg-zinc-400">
                          Add Tag
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlers.handleGenerateTags}
                    disabled={state.isGeneratingTags || !state.canGenerateTags}
                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    {state.isGeneratingTags ? "Generating..." : "Generate Tags"}
                  </Button>
                </div>
              </CardContent>
            </Card>

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
