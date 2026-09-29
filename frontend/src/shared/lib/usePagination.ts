import { useCallback, useEffect, useMemo, useState } from "react";

export interface UsePaginationOptions {
  totalPages: number;
  initialPage?: number;
  onPageChange?: (page: number) => void;
  clampEffect?: boolean;
  scrollToTop?: boolean;
}

export const usePagination = ({
  totalPages,
  initialPage = 1,
  onPageChange,
  clampEffect = true,
  scrollToTop = false,
}: UsePaginationOptions) => {
  const safeTotal = Math.max(1, totalPages);
  const [currentPage, setCurrentPage] = useState(() =>
    Math.min(Math.max(1, initialPage), safeTotal),
  );

  useEffect(() => {
    if (!clampEffect) return;
    if (currentPage > safeTotal) setCurrentPage(safeTotal);
  }, [currentPage, safeTotal, clampEffect]);

  useEffect(() => {
    if (scrollToTop) window.scrollTo(0, 0);
  }, [currentPage, scrollToTop]);

  const goTo = useCallback(
    (page: number) => {
      const clamped = Math.min(Math.max(1, page), safeTotal);
      setCurrentPage(clamped);
      onPageChange?.(clamped);
      if (scrollToTop) window.scrollTo(0, 0);
    },
    [safeTotal, onPageChange, scrollToTop],
  );

  return useMemo(
    () => ({ currentPage, totalPages: safeTotal, goTo, setCurrentPage }),
    [currentPage, safeTotal, goTo],
  );
};
