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

interface ProfilePostsSectionProps {
  blogs: any[];
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  handlePageChange: (page: number) => void;
}

export const ProfilePostsSection: React.FC<ProfilePostsSectionProps> = ({
  blogs,
  isLoading,
  currentPage,
  totalPages,
  handlePageChange,
}) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="mt-12 md:mt-16">
        <h2 className="mb-6 text-2xl font-bold text-zinc-100 md:text-3xl">Published Blogs</h2>
        <div className="grid grid-cols-1 gap-6">
          {[...Array(3)].map((_, i) => <BlogCardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-12 md:mt-16">
      <h2 className="mb-6 text-2xl font-bold text-zinc-100 md:text-3xl">Published Blogs</h2>
      {blogs.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-6">
            {blogs.map((blog) => <BlogCard key={blog.id} {...blog} />)}
          </div>
          {totalPages > 1 && (
            <div className="mt-10">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    {currentPage > 1 && (
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => { e.preventDefault(); handlePageChange(currentPage - 1); }}
                        className="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                      />
                    )}
                  </PaginationItem>
                  {[...Array(totalPages)].map((_, i) => (
                    <PaginationItem key={i}>
                      <PaginationLink
                        href="#"
                        onClick={(e) => { e.preventDefault(); handlePageChange(i + 1); }}
                        isActive={currentPage === i + 1}
                        className={`hover:bg-zinc-800 hover:text-zinc-200 ${
                          currentPage === i + 1 ? "border-zinc-700 bg-zinc-800 text-zinc-100" : "text-zinc-400"
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
                        onClick={(e) => { e.preventDefault(); handlePageChange(currentPage + 1); }}
                        className="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                      />
                    )}
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      ) : (
        <Card className="border-zinc-800 bg-zinc-900/20">
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto mb-4 h-10 w-10 text-zinc-600" />
            <h3 className="mb-2 text-xl font-semibold text-zinc-300">No blogs published yet</h3>
            <p className="mb-6 text-zinc-500">When you publish a blog, it will appear here.</p>
            <Button
              onClick={() => navigate("/create-blog")}
              className="bg-zinc-50 text-zinc-950 hover:bg-zinc-200"
            >
              Create a Blog
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
