import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@apollo/client/react";
import { BlogCard } from "./BlogCard";
import { BlogCardSkeleton } from "@/shared/ui/feedback";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PostsByTagDocument,
  PostsDocument,
} from "@/shared/graphql/content-documents";
import { useToast } from "@/shared/ui/hooks/useToast";
import { mapPostToBlogCardItem } from "@/entities/post/lib";
import { PagePagination } from "@/widgets";

interface BlogListProps {
  filterTag?: string;
}

const BLOG_LIST_HEADING = "LATEST UPDATES";

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

  const sectionHeading = (
    <p className="mb-6 font-mono text-[0.6875rem] uppercase tracking-[0.28em] text-muted-foreground">
      {BLOG_LIST_HEADING}
    </p>
  );

  if (activeQuery.loading) {
    return (
      <div className="mx-auto w-full max-w-[88rem] px-4 py-8 sm:px-5 lg:px-6">
        {sectionHeading}
        <div className="space-y-4">
          {Array.from({ length: itemsPerPage }).map((_, index) => (
            <BlogCardSkeleton key={index} />
          ))}
        </div>
        <div className="mb-6 mt-10 flex items-center justify-center space-x-2">
          <Skeleton className="h-10 w-24 rounded-none bg-surface-low" />
          <Skeleton className="h-10 w-10 rounded-none bg-surface-low" />
          <Skeleton className="h-10 w-10 rounded-none bg-surface-low" />
          <Skeleton className="h-10 w-10 rounded-none bg-surface-low" />
          <Skeleton className="h-10 w-24 rounded-none bg-surface-low" />
        </div>
      </div>
    );
  }

  if (totalPosts === 0) {
    return (
      <div className="mx-auto w-full max-w-[88rem] px-4 py-8 sm:px-5 lg:px-6">
        {sectionHeading}
        <p className="text-lg text-muted-foreground">
          {filterTag
            ? `No posts found for the tag "${filterTag}".`
            : "No blog posts available yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[88rem] px-4 py-8 sm:px-5 lg:px-6">
      {sectionHeading}
      <div className="space-y-4">
        {blogPosts.map((post) => (
          <BlogCard key={post.id} {...post} />
        ))}
      </div>

      <div className="mt-10">
        <PagePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
};
