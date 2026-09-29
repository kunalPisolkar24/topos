import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/shared/ui/primitives/pagination";
import { cn } from "@/shared/lib/cn";

export type PagePaginationAlign = "start" | "center" | "end";

export interface PagePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  align?: PagePaginationAlign;
  className?: string;
  previousClassName?: string;
  nextClassName?: string;
  activePageClassName?: string;
  inactivePageClassName?: string;
}

const ALIGNMENT_CLASSNAMES: Record<PagePaginationAlign, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
};

const handlePageLinkClick = (
  event: React.MouseEvent<HTMLAnchorElement>,
  page: number,
  onPageChange: (page: number) => void,
) => {
  event.preventDefault();
  onPageChange(page);
};

const getVisiblePages = (current: number, total: number): (number | "ellipsis")[] => {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | "ellipsis")[] = [1];
  if (current > 3) pages.push("ellipsis");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let p = start; p <= end; p++) pages.push(p);
  if (current < total - 2) pages.push("ellipsis");
  pages.push(total);
  return pages;
};

export const PagePagination = ({
  currentPage,
  totalPages,
  onPageChange,
  align = "center",
  className,
  previousClassName,
  nextClassName,
  activePageClassName = "border-primary/45 bg-primary-container/80 text-primary-foreground [box-shadow:inset_0_0_0_1px_rgb(var(--primary-fixed-dim)/0.95)]",
  inactivePageClassName = "border-outline-variant/20 bg-surface-lowest text-muted-foreground",
}: PagePaginationProps) => {
  if (totalPages <= 1) return null;

  const visiblePages = getVisiblePages(currentPage, totalPages);

  return (
    <Pagination className={cn(ALIGNMENT_CLASSNAMES[align], "w-full max-w-full overflow-x-auto", className)}>
      <PaginationContent>
        <PaginationItem>
          {currentPage > 1 ? (
            <PaginationPrevious
              href="#"
              onClick={(event) =>
                handlePageLinkClick(event, currentPage - 1, onPageChange)
              }
              className={cn(
                "border-outline-variant/20 bg-surface-lowest text-muted-foreground",
                previousClassName,
              )}
            />
          ) : null}
        </PaginationItem>
        {visiblePages.map((page, index) =>
          page === "ellipsis" ? (
            <PaginationItem key={`ellipsis-${index}`}>
              <span className="flex h-9 min-w-9 items-center justify-center px-2 font-mono text-xs text-muted-foreground" aria-hidden="true">
                …
              </span>
            </PaginationItem>
          ) : (
            <PaginationItem key={page}>
              <PaginationLink
                href="#"
                onClick={(event) => handlePageLinkClick(event, page, onPageChange)}
                isActive={currentPage === page}
                className={cn(
                  currentPage === page ? activePageClassName : inactivePageClassName,
                )}
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          {currentPage < totalPages ? (
            <PaginationNext
              href="#"
              onClick={(event) =>
                handlePageLinkClick(event, currentPage + 1, onPageChange)
              }
              className={cn(
                "border-outline-variant/20 bg-surface-lowest text-muted-foreground",
                nextClassName,
              )}
            />
          ) : null}
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
};
