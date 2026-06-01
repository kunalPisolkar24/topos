import React from "react";
import { FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { BlogCardSkeleton } from "@/components/skeletons";
import { BlogCard } from "@/features/blog";
import type { BlogCardItem } from "@/entities/post/lib";

interface ProfilePostsSectionProps {
  blogs: BlogCardItem[];
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  totalPosts: number;
  handlePageChange: (page: number) => void;
}

export const ProfilePostsSection: React.FC<ProfilePostsSectionProps> = ({
  blogs,
  isLoading,
  currentPage,
  totalPages,
  totalPosts,
  handlePageChange,
}) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <section className="mt-10 grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <ProfilePostsHeader totalPosts={totalPosts} />
        <div className="grid grid-cols-1 gap-6">
          {[...Array(3)].map((_, i) => <BlogCardSkeleton key={i} />)}
        </div>
      </section>
    );
  }

  return (
    <section className="mt-10 grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <ProfilePostsHeader totalPosts={totalPosts} />
      {blogs.length > 0 ? (
        <div>
          <div className="grid grid-cols-1 gap-6">
            {blogs.map((blog) => <BlogCard key={blog.id} {...blog} />)}
          </div>
          {totalPages > 1 && (
            <div className="mt-10">
              <Pagination className="justify-start">
                <PaginationContent>
                  <PaginationItem>
                    {currentPage > 1 && (
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          handlePageChange(currentPage - 1);
                        }}
                        className="text-muted-foreground"
                      />
                    )}
                  </PaginationItem>
                  {[...Array(totalPages)].map((_, i) => (
                    <PaginationItem key={i}>
                      <PaginationLink
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          handlePageChange(i + 1);
                        }}
                        isActive={currentPage === i + 1}
                        className={`${
                          currentPage === i + 1
                            ? "border-primary/45 bg-primary-container text-primary-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        {i + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    {currentPage < totalPages && (
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          handlePageChange(currentPage + 1);
                        }}
                        className="text-muted-foreground"
                      />
                    )}
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      ) : (
        <Card className="gap-0 bg-surface-lowest py-0">
          <CardContent className="grid gap-5 p-6 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
            <div className="flex h-12 w-12 items-center justify-center bg-primary-container text-primary-foreground">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-xl font-semibold tracking-[-0.03em] text-foreground">
                No blogs published yet
              </h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                When you publish a blog, it will appear in this author index.
              </p>
            </div>
            <Button
              onClick={() => navigate("/create-blog")}
              className="w-full sm:w-auto"
            >
              Create a Blog
            </Button>
          </CardContent>
        </Card>
      )}
    </section>
  );
};

interface ProfilePostsHeaderProps {
  totalPosts: number;
}

const ProfilePostsHeader: React.FC<ProfilePostsHeaderProps> = ({ totalPosts }) => (
  <header className="bg-surface-low p-4 ring-1 ring-outline-variant/20 lg:self-start">
    <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-primary">
      Publication Index
    </p>
    <h2 className="mt-4 text-2xl font-semibold leading-tight tracking-[-0.04em] text-foreground">
      Published Blogs
    </h2>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">
      {totalPosts} {totalPosts === 1 ? "entry" : "entries"} authored on Topos.
    </p>
  </header>
);
