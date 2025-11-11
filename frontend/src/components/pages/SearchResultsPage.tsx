import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { StickyNavbar } from '../layouts';
import { BlogCard } from '../blog';
import { BlogCardSkeleton } from '@/components/skeletons';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface PostSearchResult {
  postId: number;
  title: string;
  authorName: string;
  imageUrl: string | null;
  createdAt: string;
}

interface FormattedPostForCard {
  id: number;
  title: string;
  imageUrl: string | null;
  snippet: string;
  author: {
    name: string;
    avatarUrl: string | null;
  };
  tags: string[];
  slug: string;
  publishedAt: Date;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalResults: number;
}

const DEFAULT_PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1554995207-c18c203602cb?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=600&q=80";

const formatPostDataForBlogCard = (post: PostSearchResult): FormattedPostForCard => ({
  id: post.postId,
  title: post.title,
  imageUrl: post.imageUrl,
  snippet: 'Full content available after clicking...',
  author: { name: post.authorName, avatarUrl: null },
  tags: [],
  slug: `post-${post.postId}`,
  publishedAt: new Date(post.createdAt),
});

const SearchResultsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q');
  const page = parseInt(searchParams.get('page') || '1', 10);

  const [results, setResults] = useState<FormattedPostForCard[]>([]);
  const [paginationInfo, setPaginationInfo] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!query) {
      navigate('/');
      return;
    }

    const fetchResults = async () => {
      setIsLoading(true);
      try {
        const response = await axios.get<{ data: PostSearchResult[]; pagination: PaginationInfo }>(
          `${import.meta.env.VITE_BACKEND_URL}/api/search?q=${encodeURIComponent(query)}&page=${page}&limit=6`
        );
        setResults(response.data.data.map(formatPostDataForBlogCard));
        setPaginationInfo(response.data.pagination);
      } catch (error) {
        console.error('Failed to fetch search results:', error);
        setResults([]);
        setPaginationInfo(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
    window.scrollTo(0, 0);
  }, [query, page, navigate]);

  const handlePageChange = (newPage: number) => {
    if (query) {
      setSearchParams({ q: query, page: newPage.toString() });
    }
  };

  const renderPagination = () => {
    if (!paginationInfo || paginationInfo.totalPages <= 1) {
      return null;
    }

    const { currentPage, totalPages } = paginationInfo;

    return (
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            {currentPage > 1 && (
              <PaginationPrevious
                href="#"
                onClick={(e) => { e.preventDefault(); handlePageChange(currentPage - 1); }}
              />
            )}
          </PaginationItem>
          {Array.from({ length: totalPages }, (_, i) => (
            <PaginationItem key={i}>
              <PaginationLink
                href="#"
                onClick={(e) => { e.preventDefault(); handlePageChange(i + 1); }}
                isActive={currentPage === i + 1}
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
      <main className="container mx-auto py-8 mt-[70px]">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-1 gap-8 m-6 max-w-7xl lg:mx-auto">
            {Array.from({ length: 5 }).map((_, index) => <BlogCardSkeleton key={index} />)}
          </div>
        ) : (
          <>
            <div className='max-w-7xl lg:mx-auto px-4'>
              <h1 className="text-3xl font-bold text-zinc-100 mb-2">
                Search Results for "{query}"
              </h1>
              <p className="text-zinc-400 mb-8">
                {paginationInfo?.totalResults ?? 0} posts found.
              </p>
            </div>
            
            {results.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-1 gap-8 m-6 max-w-7xl lg:mx-auto">
                {results.map(post => (
                  <BlogCard 
                    key={post.id} 
                    {...post} 
                    imageUrl={post.imageUrl || DEFAULT_PLACEHOLDER_IMAGE} 
                  />
                ))}
              </div>
            ) : (
              <p className="text-center text-zinc-400 text-xl mt-16">
                No posts found matching your query.
              </p>
            )}
            <div className="mt-12">
              {renderPagination()}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default SearchResultsPage;