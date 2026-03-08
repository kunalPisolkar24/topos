import React, { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@apollo/client/react";
import { StickyNavbar } from "../layouts";
import { BlogCard } from "../blog";
import { BlogCardSkeleton } from "@/components/skeletons";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { SearchPostsDocument } from "@/graphql/content-documents";
import { buildSearchPagination, mapPostToBlogCardItem } from "@/lib/content";

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

  const renderPagination = () => {
    if (paginationInfo.totalPages <= 1) {
      return null;
    }

    return (
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            {paginationInfo.currentPage > 1 && (
              <PaginationPrevious
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  handlePageChange(paginationInfo.currentPage - 1);
                }}
              />
            )}
          </PaginationItem>
          {Array.from({ length: paginationInfo.totalPages }, (_, index) => (
            <PaginationItem key={index}>
              <PaginationLink
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  handlePageChange(index + 1);
                }}
                isActive={paginationInfo.currentPage === index + 1}
              >
                {index + 1}
              </PaginationLink>
            </PaginationItem>
          ))}
          <PaginationItem>
            {paginationInfo.currentPage < paginationInfo.totalPages && (
              <PaginationNext
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  handlePageChange(paginationInfo.currentPage + 1);
                }}
              />
            )}
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-900/20">
      <StickyNavbar />
      <main className="container mx-auto mt-[70px] py-8">
        {loading ? (
          <div className="m-6 grid max-w-7xl grid-cols-1 gap-8 md:grid-cols-1 lg:mx-auto">
            {Array.from({ length: 5 }).map((_, index) => (
              <BlogCardSkeleton key={index} />
            ))}
          </div>
        ) : (
          <>
            <div className="max-w-7xl px-4 lg:mx-auto">
              <h1 className="mb-2 text-3xl font-bold text-zinc-100">
                Search Results for "{query}"
              </h1>
              <p className="mb-8 text-zinc-400">
                {data?.searchPosts.total ?? 0} posts found.
              </p>
            </div>

            {results.length > 0 ? (
              <div className="m-6 grid max-w-7xl grid-cols-1 gap-8 md:grid-cols-1 lg:mx-auto">
                {results.map((post) => (
                  <BlogCard key={post.id} {...post} />
                ))}
              </div>
            ) : (
              <p className="mt-16 text-center text-xl text-zinc-400">
                No posts found matching your query.
              </p>
            )}
            <div className="mt-12">{renderPagination()}</div>
          </>
        )}
      </main>
    </div>
  );
};

export default SearchResultsPage;
