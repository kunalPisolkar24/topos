import React, { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@apollo/client/react";
import { PagePagination, StickyNavbar } from "@/widgets";
import { BlogCard } from "@/features/blog";
import { BlogCardSkeleton } from "@/shared/ui/feedback";
import { SearchPostsDocument } from "@/shared/graphql/content-documents";
import { buildSearchPagination, mapPostToBlogCardItem } from "@/entities/post/lib";

const SEARCH_RESULTS_PAGE_SIZE = 6;

const SearchResultsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get("q")?.trim() ?? "";
  const requestedPage = Number.parseInt(searchParams.get("page") || "1", 10);
  const page = Number.isNaN(requestedPage) || requestedPage < 1 ? 1 : requestedPage;

  useEffect(() => {
    if (!query) {
      navigate("/");
    }
  }, [navigate, query]);

  const { data, loading } = useQuery(SearchPostsDocument, {
    variables: {
      query,
      page,
      limit: SEARCH_RESULTS_PAGE_SIZE,
    },
    skip: query.length === 0,
    notifyOnNetworkStatusChange: true,
  });

  const results = useMemo(
    () => data?.searchPosts.hits.map(mapPostToBlogCardItem) ?? [],
    [data],
  );

  const paginationInfo = useMemo(
    () =>
      buildSearchPagination(
        data?.searchPosts.total ?? 0,
        page,
        SEARCH_RESULTS_PAGE_SIZE,
      ),
    [data, page],
  );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page, query]);

  const handlePageChange = (nextPage: number) => {
    if (query) {
      setSearchParams({ q: query, page: nextPage.toString() });
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      <StickyNavbar />
      <main className="container mx-auto pb-8 pt-app-navbar-offset">
        {loading ? (
          <div className="m-6 grid max-w-[88rem] grid-cols-1 gap-8 px-4 sm:px-5 lg:mx-auto lg:px-6">
            {Array.from({ length: 5 }).map((_, index) => (
              <BlogCardSkeleton key={index} />
            ))}
          </div>
        ) : (
          <>
            <div className="max-w-[88rem] px-4 sm:px-5 lg:mx-auto lg:px-6">
              <h1 className="mb-2 text-3xl font-semibold tracking-[-0.02em] text-foreground">
                Search Results for "{query}"
              </h1>
              <p className="mb-8 text-sm text-muted-foreground">
                {data?.searchPosts.total ?? 0} posts found.
              </p>
            </div>

            {results.length > 0 ? (
              <div className="m-6 grid max-w-[88rem] grid-cols-1 gap-8 px-4 sm:px-5 lg:mx-auto lg:px-6">
                {results.map((post) => (
                  <BlogCard key={post.id} {...post} />
                ))}
              </div>
            ) : (
              <p className="mt-16 text-lg text-muted-foreground">
                No posts found matching your query.
              </p>
            )}
            <div className="mt-12">
              <PagePagination
                currentPage={paginationInfo.currentPage}
                totalPages={paginationInfo.totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default SearchResultsPage;
