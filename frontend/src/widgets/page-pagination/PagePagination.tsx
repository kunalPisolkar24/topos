import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

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

  return (
    <Pagination className={cn(ALIGNMENT_CLASSNAMES[align], className)}>
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
        {Array.from({ length: totalPages }, (_, index) => {
          const page = index + 1;
          const isActive = currentPage === page;
          return (
            <PaginationItem key={page}>
              <PaginationLink
                href="#"
                onClick={(event) => handlePageLinkClick(event, page, onPageChange)}
                isActive={isActive}
                className={cn(
                  isActive ? activePageClassName : inactivePageClassName,
                )}
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          );
        })}
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
