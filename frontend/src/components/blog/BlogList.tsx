import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@apollo/client/react";
import { BlogCard } from "./BlogCard";
import { BlogCardSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  PostsByTagDocument,
  PostsDocument,
} from "@/graphql/content-documents";
import { useToast } from "@/hooks/use-toast";
import { mapPostToBlogCardItem } from "@/lib/content";

interface BlogListProps {
  filterTag?: string;
}

export const BlogList: React.FC<BlogListProps> = ({ filterTag }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();
  const itemsPerPage = 6;

  const postsQuery = useQuery(PostsDocument, {
    variables: {
      page: currentPage,
      limit: itemsPerPage,
    },
    skip: Boolean(filterTag),
    notifyOnNetworkStatusChange: true,
  });

  const postsByTagQuery = useQuery(PostsByTagDocument, {
    variables: {
      tag: filterTag ?? "",
      page: currentPage,
      limit: itemsPerPage,
    },
    skip: !filterTag,
    notifyOnNetworkStatusChange: true,
  });

  const activeQuery = filterTag ? postsByTagQuery : postsQuery;
  const paginatedPosts = filterTag
    ? postsByTagQuery.data?.postsByTag
    : postsQuery.data?.posts;

  const blogPosts = useMemo(
    () => paginatedPosts?.posts.map(mapPostToBlogCardItem) ?? [],
    [paginatedPosts],
  );

  const totalPages = paginatedPosts?.totalPages ?? 1;
  const totalPosts = paginatedPosts?.totalPosts ?? 0;

  useEffect(() => {
    setCurrentPage(1);
  }, [filterTag]);

  useEffect(() => {
    if (!activeQuery.error) {
      return;
    }

    toast({
      title: "Error",
      description: "Could not load blog posts.",
      variant: "destructive",
    });
  }, [activeQuery.error, toast]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  if (activeQuery.loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 gap-8 m-6 max-w-7xl xs:m-[15px] sm:m-[20px] md:m-[30px] md:grid-cols-1 lg:m-[40px] lg:mx-auto lg:grid-cols-1">
          {Array.from({ length: itemsPerPage }).map((_, index) => (
            <BlogCardSkeleton key={index} />
          ))}
        </div>
        <div className="mt-10 mb-6 flex items-center justify-center space-x-2">
          <Skeleton className="h-10 w-24 rounded-md bg-zinc-800" />
          <Skeleton className="h-10 w-10 rounded-md bg-zinc-800" />
          <Skeleton className="h-10 w-10 rounded-md bg-zinc-800" />
          <Skeleton className="h-10 w-10 rounded-md bg-zinc-800" />
          <Skeleton className="h-10 w-24 rounded-md bg-zinc-800" />
        </div>
      </div>
    );
  }

  if (totalPosts === 0) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-xl text-zinc-400">
          {filterTag
            ? `No posts found for the tag "${filterTag}".`
            : "No blog posts available yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 gap-8 m-6 max-w-7xl xs:m-[15px] sm:m-[20px] md:m-[30px] md:grid-cols-1 lg:m-[40px] lg:mx-auto lg:grid-cols-1">
        {blogPosts.map((post) => (
          <BlogCard key={post.id} {...post} />
        ))}
      </div>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              {currentPage > 1 && (
                <PaginationPrevious
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    handlePageChange(currentPage - 1);
                  }}
                  className="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                />
              )}
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, index) => (
              <PaginationItem key={index}>
                <PaginationLink
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    handlePageChange(index + 1);
                  }}
                  isActive={currentPage === index + 1}
                  className={`hover:bg-zinc-800 hover:text-zinc-200 ${
                    currentPage === index + 1
                      ? "border-zinc-700 bg-zinc-800 text-zinc-100"
                      : "text-zinc-400"
                  }`}
                >
                  {index + 1}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              {currentPage < totalPages && (
                <PaginationNext
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    handlePageChange(currentPage + 1);
                  }}
                  className="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                />
              )}
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
};
