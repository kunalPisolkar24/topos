import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, FileText } from "lucide-react";
import { Card, CardContent } from "@/shared/ui/primitives/card";
import { Button } from "@/shared/ui/primitives/button";
import { PagePagination } from "@/shared/ui/PagePagination";
import { cn } from "@/shared/lib/cn";
import {
  useProfilePublicationIndex,
  type PublicationFilter,
  type PublicationMarker,
} from "@/features/user/posts/useProfilePublicationIndex";

interface ProfilePublicationIndexProps {
  userId: string | undefined;
}

const markerStyles: Record<PublicationMarker, string> = {
  published:
    "rounded-none border border-primary/30 bg-primary px-2 py-0.5 font-mono text-[0.625rem] font-medium uppercase tracking-[0.18em] text-primary-foreground",
  pending:
    "rounded-none border border-outline-variant/20 bg-primary-container px-2 py-0.5 font-mono text-[0.625rem] font-medium uppercase tracking-[0.18em] text-primary-foreground",
  rejected:
    "rounded-none border border-destructive/20 bg-destructive px-2 py-0.5 font-mono text-[0.625rem] font-medium uppercase tracking-[0.18em] text-destructive-foreground",
};

const filterLabels: Record<PublicationFilter, string> = {
  all: "All",
  published: "Published",
  pending: "Pending",
  rejected: "Rejected",
};

const formatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const ProfilePublicationIndex: React.FC<ProfilePublicationIndexProps> = ({ userId }) => {
  const navigate = useNavigate();
  const {
    counts,
    isLoading,
    isEmpty,
    activeFilter,
    setActiveFilter,
    filteredRows,
    paginatedRows,
    currentPage,
    totalPages,
    setCurrentPage,
    hasMore,
  } = useProfilePublicationIndex({ userId });

  if (isLoading) {
    return (
      <section className="mt-8 grid gap-5 sm:mt-10 sm:gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <ProfilePublicationHeader counts={counts} activeFilter={activeFilter} onFilterChange={setActiveFilter} />
        <div className="grid grid-cols-1 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse bg-surface-lowest ring-1 ring-outline-variant/20" />
          ))}
        </div>
      </section>
    );
  }

  // All empty (no published and no pending/rejected)
  if (isEmpty) {
    return (
      <section className="mt-8 grid gap-5 sm:mt-10 sm:gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <ProfilePublicationHeader counts={counts} activeFilter={activeFilter} onFilterChange={setActiveFilter} />
        <Card className="gap-0 bg-surface-lowest py-0">
          <CardContent className="grid gap-5 p-4 sm:p-6 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
            <div className="flex h-10 w-10 items-center justify-center bg-primary-container text-primary-foreground sm:h-12 sm:w-12">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-lg font-semibold tracking-[-0.03em] text-foreground sm:text-xl">No publications yet</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Published, pending, and rejected posts will appear here with filters.
              </p>
            </div>
            <Button onClick={() => navigate("/create-blog")} className="w-full sm:w-auto">
              Create a Blog
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  // Filter empty (e.g., no pending but has published)
  if (filteredRows.length === 0) {
    return (
      <section className="mt-8 grid gap-5 sm:mt-10 sm:gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <ProfilePublicationHeader counts={counts} activeFilter={activeFilter} onFilterChange={setActiveFilter} />
        <div className="bg-surface-low p-4 ring-1 ring-outline-variant/20 sm:p-6">
          <p className="font-mono text-[0.625rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {filterLabels[activeFilter]} — empty
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            No {filterLabels[activeFilter].toLowerCase()} entries in this view.
          </p>
          <Button variant="outline" size="sm" className="mt-4 w-full sm:w-auto" onClick={() => setActiveFilter("all")}>
            Show all
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8 grid gap-5 sm:mt-10 sm:gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <ProfilePublicationHeader counts={counts} activeFilter={activeFilter} onFilterChange={setActiveFilter} />
      <div>
        <div className="grid gap-2 sm:gap-3">
          {paginatedRows.map((row) => (
            <Link
              key={`${row.marker}-${row.id}`}
              to={row.href}
              className="group flex flex-col gap-2 border border-outline-variant/20 bg-surface-lowest p-3 ring-1 ring-transparent transition-colors hover:border-primary/30 hover:bg-surface-low focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary sm:flex-row sm:items-center sm:gap-3 sm:px-4 sm:py-3"
              aria-label={`${row.statusLabel}: ${row.title}`}
            >
              <div className="flex items-center justify-between gap-2 sm:contents">
                <span className={cn("shrink-0", markerStyles[row.marker])}>{row.statusLabel}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary sm:hidden" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium leading-6 text-foreground group-hover:text-primary sm:truncate">
                  {row.title}
                </p>
                <p className="mt-1 line-clamp-1 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground sm:truncate">
                  {formatDate(row.date)} · {row.snippet || "No summary"}
                </p>
              </div>
              <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary sm:block" aria-hidden="true" />
            </Link>
          ))}
        </div>

        {hasMore && activeFilter === "all" && (
          <div className="mt-3 text-left sm:text-right">
            <Button variant="ghost" size="xs" onClick={() => navigate("/review")} className="w-full justify-center font-mono text-[0.625rem] tracking-[0.14em] sm:w-auto sm:justify-start">
              View all in review queue →
            </Button>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-6 overflow-x-auto pb-1 sm:mt-8">
            <PagePagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              align="start"
              previousClassName="text-muted-foreground"
              nextClassName="text-muted-foreground"
              activePageClassName="border-primary/45 bg-primary-container text-primary-foreground"
              inactivePageClassName="text-muted-foreground"
            />
          </div>
        )}
      </div>
    </section>
  );
};

interface ProfilePublicationHeaderProps {
  counts: { all: number; published: number; pending: number; rejected: number };
  activeFilter: PublicationFilter;
  onFilterChange: (filter: PublicationFilter) => void;
}

const ProfilePublicationHeader: React.FC<ProfilePublicationHeaderProps> = ({ counts, activeFilter, onFilterChange }) => {
  const filters: PublicationFilter[] = ["all", "published", "pending", "rejected"];
  return (
    <header className="bg-surface-low p-3 ring-1 ring-outline-variant/20 sm:p-4 lg:sticky lg:top-[calc(var(--app-navbar-offset)+0.75rem)] lg:self-start">
      <p className="font-mono text-[0.625rem] font-medium uppercase tracking-[0.22em] text-primary sm:text-[0.6875rem]">Publication Index</p>
      <h2 className="mt-3 text-xl font-semibold leading-tight tracking-[-0.04em] text-foreground sm:mt-4 sm:text-2xl">All Posts</h2>
      <div className="mt-3 flex flex-col gap-1.5 sm:mt-4">
        {filters.map((filter) => {
          const isActive = activeFilter === filter;
          return (
            <button
              key={filter}
              type="button"
              onClick={() => onFilterChange(filter)}
              aria-pressed={isActive}
              className={cn(
                "min-h-9 rounded-none border px-3 py-2 text-left font-mono text-[0.625rem] font-medium uppercase tracking-[0.16em] transition-colors",
                isActive
                  ? "border-primary/30 bg-primary-container text-primary-foreground"
                  : "border-outline-variant/20 bg-surface-lowest text-muted-foreground hover:border-primary/20 hover:text-foreground",
              )}
            >
              <span className="flex items-center justify-between gap-1 sm:inline">
                {filterLabels[filter]}{" "}
                <span className={cn("shrink-0", isActive ? "text-primary-foreground/80" : "text-muted-foreground/80")}>
                  {counts[filter]}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
