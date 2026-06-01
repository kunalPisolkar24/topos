"use client";

import type React from "react";
import { Sparkles } from "lucide-react";
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
            <>
              <header className="relative overflow-hidden bg-surface-low p-5 ring-1 ring-outline-variant/20 sm:p-8 lg:p-10 mb-6">
                <div
                  className="absolute inset-0 opacity-30 [background-image:linear-gradient(to_right,rgb(var(--outline-variant)/0.16)_1px,transparent_1px),linear-gradient(to_bottom,rgb(var(--outline-variant)/0.12)_1px,transparent_1px)] [background-size:4rem_4rem]"
                  aria-hidden="true"
                />
                <div className="absolute right-0 top-0 h-28 w-28 bg-primary-container" aria-hidden="true" />
                <div className="relative max-w-3xl">
                  <div className="mb-5 inline-flex items-center gap-2 bg-primary-container px-3 py-2 text-primary-foreground">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    <span className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.18em]">
                      Revision Console
                    </span>
                  </div>
                  <h1 className="text-4xl font-semibold leading-none tracking-[-0.05em] text-foreground md:text-6xl">
                    Revise your Topos post.
                  </h1>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
                    Modify the title, cover image, body text, or tags. Saved revisions are updated instantly across all channels.
                  </p>
                </div>
              </header>

              <BlogEditForm
                blog={blog}
                onCancel={() => setIsEditing(false)}
                onComplete={() => {
                  setIsEditing(false);
                  refetch();
                }}
              />
            </>
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
