import { useMemo, useState } from "react";
import { userRepository } from "@/entities/user/api/userRepository";
import { draftRepository } from "@/entities/draft/api/draftRepository";
import { toPlainText } from "@/entities/post/lib/post-text";

export type PublicationMarker = "published" | "pending" | "rejected";
export type PublicationFilter = "all" | PublicationMarker;

export interface PublicationRow {
  id: string;
  title: string;
  snippet: string;
  date: string;
  marker: PublicationMarker;
  href: string;
  statusLabel: string;
}

export interface UseProfilePublicationIndexProps {
  userId: string | undefined;
  pageSize?: number;
}

export interface ProfilePublicationCounts {
  all: number;
  published: number;
  pending: number;
  rejected: number;
}

export interface UseProfilePublicationIndexResult {
  rows: PublicationRow[];
  counts: ProfilePublicationCounts;
  isLoading: boolean;
  isEmpty: boolean;
  activeFilter: PublicationFilter;
  setActiveFilter: (filter: PublicationFilter) => void;
  filteredRows: PublicationRow[];
  paginatedRows: PublicationRow[];
  currentPage: number;
  totalPages: number;
  setCurrentPage: (page: number) => void;
  totalPosts: number;
  hasMore: boolean;
}

const PAGE_FETCH_LIMIT = 20;
const ROWS_PER_PAGE = 6;

const truncateSnippet = (text: string, maxChars: number): string => {
  const plain = toPlainText(text).trim();
  if (plain.length <= maxChars) return plain;
  const window = plain.slice(0, maxChars);
  const lastWhitespace = window.search(/\s\S*$/);
  const cutPoint = lastWhitespace > 0 ? lastWhitespace : maxChars;
  return `${window.slice(0, cutPoint).trimEnd()}...`;
};

const statusLabelMap: Record<PublicationMarker, string> = {
  published: "Published",
  pending: "Pending",
  rejected: "Rejected",
};

export const useProfilePublicationIndex = ({
  userId,
  pageSize = ROWS_PER_PAGE,
}: UseProfilePublicationIndexProps): UseProfilePublicationIndexResult => {
  const [activeFilter, setActiveFilter] = useState<PublicationFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);

  const postsQuery = userRepository.useMyPosts(1, PAGE_FETCH_LIMIT, { skip: !userId });
  const draftsQuery = draftRepository.useMyPostDrafts(1, { skip: !userId });

  // Reset page when filter changes
  const handleSetFilter = (filter: PublicationFilter) => {
    setActiveFilter(filter);
    setCurrentPage(1);
  };

  const rows = useMemo<PublicationRow[]>(() => {
    const publishedRows: PublicationRow[] =
      postsQuery.data?.me?.posts.posts.map((post) => ({
        id: post.id,
        title: post.title,
        snippet: truncateSnippet(post.body, 96),
        date: post.createdAt,
        marker: "published" as const,
        href: `/blog/${post.id}`,
        statusLabel: statusLabelMap.published,
      })) ?? [];

    const draftRows: PublicationRow[] =
      (draftsQuery.data?.myPostDrafts.drafts ?? [])
        .filter((draft) => draft.status !== "APPROVED")
        .map((draft) => {
          const marker = draft.status === "REJECTED" ? ("rejected" as const) : ("pending" as const);
          return {
            id: draft.id,
            title: draft.title,
            snippet: truncateSnippet(draft.body, 96),
            date: draft.updatedAt,
            marker,
            href: `/review/${draft.id}`,
            statusLabel: statusLabelMap[marker],
          };
        });

    const merged = [...publishedRows, ...draftRows];
    merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return merged;
  }, [postsQuery.data, draftsQuery.data]);

  const counts = useMemo<ProfilePublicationCounts>(() => {
    let published = 0;
    let pending = 0;
    let rejected = 0;
    for (const row of rows) {
      if (row.marker === "published") published += 1;
      else if (row.marker === "pending") pending += 1;
      else if (row.marker === "rejected") rejected += 1;
    }
    return { all: rows.length, published, pending, rejected };
  }, [rows]);

  const isLoading = postsQuery.loading || draftsQuery.loading;
  const isEmpty = !isLoading && rows.length === 0;

  const filteredRows = useMemo(() => {
    if (activeFilter === "all") return rows;
    return rows.filter((row) => row.marker === activeFilter);
  }, [rows, activeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const totalPosts = postsQuery.data?.me?.posts.totalPosts ?? 0;
  const hasMore =
    (postsQuery.data?.me?.posts.totalPosts ?? 0) > PAGE_FETCH_LIMIT ||
    (draftsQuery.data?.myPostDrafts.totalDrafts ?? 0) > PAGE_FETCH_LIMIT;

  return {
    rows,
    counts,
    isLoading,
    isEmpty,
    activeFilter,
    setActiveFilter: handleSetFilter,
    filteredRows,
    paginatedRows,
    currentPage,
    totalPages,
    setCurrentPage,
    totalPosts,
    hasMore,
  };
};
