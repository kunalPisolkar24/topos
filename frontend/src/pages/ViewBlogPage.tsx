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
      <div className="min-h-screen bg-surface">
        <StickyNavbar />
        <div className="container mx-auto px-4 sm:px-6 lg:px-10 pb-12 pt-app-navbar-offset text-center font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-muted-foreground">
          Blog post not found.
        </div>
      </div>
    );
  }

  const isAuthor = currentUser?.id === blog.author.id;

  return (
    <div className="min-h-screen bg-surface">
      <StickyNavbar />
      <div className="container mx-auto px-4 sm:px-6 lg:px-10 pb-12 pt-app-navbar-offset">
        <div className="flex flex-col lg:flex-row gap-8">
          <main className="flex-1 min-w-0">
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
                <div className="mt-10 pt-6">
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
