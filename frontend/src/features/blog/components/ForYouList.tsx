import React, { useEffect, useMemo, useState } from "react";
import { BlogCard } from "./BlogCard";
import { BlogCardSkeleton } from "@/shared/ui/feedback";
import { Skeleton } from "@/shared/ui/primitives/skeleton";
import { Button } from "@/shared/ui/primitives/button";
import { useSessionStore } from "@/entities/session";
import { FeedModeProvider } from "@/features/blog/feed-mode";
import { markFeedMode } from "@/features/blog/viewing/feed-attribution";
import { type RecommendMode } from "@/shared/graphql/content-documents";
import { mapPostToBlogCardItem } from "@/features/blog/presenters/blog-card-presenter";
import { postRepository } from "@/entities/post/api/postRepository";
import { PagePagination } from "@/shared/ui/PagePagination";
import { useToast } from "@/shared/ui/hooks/useToast";

const ITEMS_PER_PAGE = 6;
const FOR_YOU_HEADING = "FOR YOU";

const randomSeed = () => Math.floor(Math.random() * 1_000_000);

// Stable for the session so back-navigation keeps the same order;
// Surprise-me generates a fresh one explicitly.
let sessionSeed: number | null = null;

const getSessionSeed = () => {
  if (sessionSeed === null) sessionSeed = randomSeed();
  return sessionSeed;
};

export const ForYouList: React.FC = () => {
  const isAuthenticated =
    useSessionStore((state) => state.status) === "authenticated";
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [mode, setMode] = useState<RecommendMode>("DEFAULT");
  const [seed, setSeed] = useState(getSessionSeed);
  const [useLatestFallback, setUseLatestFallback] = useState(false);

  const recommendedQuery = postRepository.useRecommended({
    page: currentPage,
    limit: ITEMS_PER_PAGE,
    mode,
    seed,
    skip: !isAuthenticated || useLatestFallback,
  });

  const latestQuery = postRepository.useList({
    page: currentPage,
    limit: ITEMS_PER_PAGE,
    skip: isAuthenticated && !useLatestFallback,
  });

  const showLatest = !isAuthenticated || useLatestFallback;
  const paginatedPosts = showLatest
    ? latestQuery.data?.posts
    : recommendedQuery.data?.recommendedPosts;

  const reasonById = useMemo(() => {
    const reasons = recommendedQuery.data?.recommendedPosts?.reasons ?? [];
    return new Map(reasons.map((entry) => [entry.postId, entry.reason]));
  }, [recommendedQuery.data]);

  useEffect(() => {
    if (!isAuthenticated || useLatestFallback) {
      return;
    }
    const recommended = recommendedQuery.data?.recommendedPosts;
    const isEmptyResult =
      !recommendedQuery.loading && recommended && recommended.posts.length === 0;
    if (recommendedQuery.error || isEmptyResult) {
      setUseLatestFallback(true);
      toast({
        title: "Personalized feed unavailable",
        description: "Showing latest posts instead.",
        variant: "destructive",
      });
    }
  }, [
    recommendedQuery.data,
    recommendedQuery.error,
    recommendedQuery.loading,
    isAuthenticated,
    useLatestFallback,
    toast,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [mode, seed]);

  useEffect(() => {
    setUseLatestFallback(false);
  }, [mode, currentPage]);

  const blogPosts = useMemo(
    () =>
      paginatedPosts?.posts.map((post) => ({
        ...mapPostToBlogCardItem(post),
        reason: showLatest ? undefined : reasonById.get(post.id),
      })) ?? [],
    [paginatedPosts, showLatest, reasonById],
  );

  // Remember the feed mode per rendered card so the view recorded on
  // the detail page can be attributed to this feed. Only the
  // recommendation feed attributes: the latest fallback is not a
  // personalized feed, so it leaves no attribution behind.
  useEffect(() => {
    if (!isAuthenticated || useLatestFallback) {
      return;
    }
    blogPosts.forEach((post) => markFeedMode(post.id, mode));
  }, [blogPosts, mode, isAuthenticated, useLatestFallback]);

  const totalPages = paginatedPosts?.totalPages ?? 1;
  const totalPosts = paginatedPosts?.totalPosts ?? 0;

  const handleSurprise = () => {
    setMode("SURPRISE");
    setSeed(randomSeed());
    setUseLatestFallback(false);
  };

  const handleRetry = () => {
    setUseLatestFallback(false);
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const sectionHeading = (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="font-mono text-[0.6875rem] uppercase tracking-[0.28em] text-muted-foreground">
        {FOR_YOU_HEADING}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {isAuthenticated && useLatestFallback && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={handleRetry}
          >
            Retry personalized feed
          </Button>
        )}
        {isAuthenticated && (
          <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={handleSurprise}>
            Surprise me
          </Button>
        )}
      </div>
    </div>
  );

  const loading = showLatest ? latestQuery.loading : recommendedQuery.loading;

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[88rem] px-4 py-8 sm:px-5 lg:px-6">
        {sectionHeading}
        <div className="space-y-4">
          {Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (
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
          No blog posts available yet.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[88rem] px-4 py-8 sm:px-5 lg:px-6">
      {sectionHeading}
      <FeedModeProvider value={showLatest ? null : mode}>
        <div className="space-y-4">
          {blogPosts.map((post) => (
            <BlogCard key={post.id} {...post} />
          ))}
        </div>
      </FeedModeProvider>

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
