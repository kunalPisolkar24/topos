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
      <div className="min-h-screen bg-surface text-foreground">
        <StickyNavbar />
        <main className="container mx-auto px-4 pb-20 pt-app-navbar-offset sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl bg-surface-low p-6 ring-1 ring-outline-variant/20 sm:p-8">
            <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-primary">
              Missing Article
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
              Blog post not found.
            </h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              The requested post may have been deleted or moved.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const isAuthor = currentUser?.id === blog.author.id;

  return (
    <div className="min-h-screen bg-surface text-foreground">
      <StickyNavbar />
      <main className="container mx-auto px-4 pb-20 pt-app-navbar-offset sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {isEditing ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_384px]">
              <section className="min-w-0">
                <BlogEditForm
                  blog={blog}
                  onCancel={() => setIsEditing(false)}
                  onComplete={() => {
                    setIsEditing(false);
                    refetch();
                  }}
                />
              </section>
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
          ) : (
            <>
              <BlogHeader
                title={blog.title}
                imageUrl={blog.imageUrl}
                createdAt={blog.createdAt}
                updatedAt={blog.updatedAt}
              />
              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_384px]">
                <section className="min-w-0 space-y-6">
                  <BlogBody body={blog.body} tags={blog.tags} />
                  <div className="bg-surface-low p-4 ring-1 ring-outline-variant/20 sm:p-5">
                    <p className="mb-4 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-primary">
                      Reading Utility
                    </p>
                    <AISummaryDialog
                      summary={blog.summary}
                      summaryStatus={blog.summaryStatus}
                      isOpen={isSummaryDialogOpen}
                      onOpenChange={setIsSummaryDialogOpen}
                    />
                  </div>
                </section>

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
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default ViewBlogPage;
