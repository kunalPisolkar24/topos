import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PagePagination } from "@/shared/ui/PagePagination";
import { StickyNavbar } from "@/widgets";
import { BlogCard } from "@/features/blog";
import { BlogCardSkeleton } from "@/shared/ui/feedback";
import { useSearchResultsController } from "@/features/search/useSearchResultsController";
import { getGraphQLErrorMessage } from "@/shared/api";

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

  const { results, paginationInfo, loading, error, data } =
    useSearchResultsController(query, page, SEARCH_RESULTS_PAGE_SIZE);

  const totalPages = paginationInfo.totalPages;
  useEffect(() => {
    if (!loading && data?.searchPosts && page > totalPages) {
      setSearchParams({ q: query, page: totalPages.toString() });
    }
  }, [page, totalPages, loading, data, query, setSearchParams]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page, query]);

  const handlePageChange = (nextPage: number) => {
    if (query) {
      setSearchParams({ q: query, page: nextPage.toString() });
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-surface">
        <StickyNavbar />
        <main className="container mx-auto pb-8 pt-app-navbar-offset">
          <div className="max-w-[88rem] px-4 sm:px-5 lg:mx-auto lg:px-6">
            <p className="text-sm text-destructive">{getGraphQLErrorMessage(error, "Could not load search results.")}</p>
          </div>
        </main>
      </div>
    );
  }

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
                {data?.searchPosts?.total ?? 0} posts found.
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
