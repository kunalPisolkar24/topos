"use client";

import type React from "react";
import { StickyNavbar } from "@/layouts";
import { ViewBlogPageSkeleton } from "@/components/skeletons";
import { 
  useViewBlog,
  BlogAuthorSidebar,
  BlogEditForm,
  AISummaryDialog,
  BlogHeader,
  BlogBody,
} from "@/features/blog";
import { useCurrentUser } from "@/features/auth";

const ViewBlogPage: React.FC = () => {
  const { user: currentUser } = useCurrentUser();
  const {
    blog,
    loading,
    isEditing,
    setIsEditing,
    isDeleting,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    isSummaryDialogOpen,
    setIsSummaryDialogOpen,
    confirmDelete,
    refetch,
  } = useViewBlog();

  if (loading) return <ViewBlogPageSkeleton />;

  if (!blog) {
    return (
      <div className="min-h-screen bg-zinc-950/20">
        <StickyNavbar />
        <div className="container mx-auto px-4 py-8 mt-[70px] text-center text-zinc-400">
          Blog post not found.
        </div>
      </div>
    );
  }

  const isAuthor = currentUser?.id === blog.author.id;

  return (
    <div className="min-h-screen bg-zinc-950/20">
      <StickyNavbar />
      <div className="container mx-auto px-4 py-8 mt-[50px]">
        <div className="flex flex-col lg:flex-row gap-8">
          <main className="flex-1">
            {isEditing ? (
              <BlogEditForm
                blog={blog}
                onCancel={() => setIsEditing(false)}
                onComplete={() => {
                  setIsEditing(false);
                  refetch();
                }}
              />
            ) : (
              <>
                <BlogHeader
                  title={blog.title}
                  imageUrl={blog.imageUrl}
                  createdAt={blog.createdAt}
                  updatedAt={blog.updatedAt}
                />
                <BlogBody body={blog.body} tags={blog.tags} />
                <div className="mt-8 pt-3 border-t border-zinc-800">
                  <AISummaryDialog
                    summary={blog.summary}
                    summaryStatus={blog.summaryStatus}
                    isOpen={isSummaryDialogOpen}
                    onOpenChange={setIsSummaryDialogOpen}
                  />
                </div>
              </>
            )}
          </main>

          <BlogAuthorSidebar
            author={blog.author}
            isAuthor={isAuthor}
            isEditing={isEditing}
            onEdit={() => setIsEditing(true)}
            onDelete={confirmDelete}
            isDeleting={isDeleting}
            isDeleteDialogOpen={isDeleteDialogOpen}
            setIsDeleteDialogOpen={setIsDeleteDialogOpen}
          />
        </div>
      </div>
    </div>
  );
};

export default ViewBlogPage;
