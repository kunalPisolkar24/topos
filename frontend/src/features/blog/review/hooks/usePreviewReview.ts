import { useCallback, useEffect, useState } from "react";
import { isPreview } from "@/shared/config/preview";
import {
  previewListReviewedDrafts,
} from "@/mocks/preview/preview-store";

export const usePreviewReviewedDrafts = (
  reviewerId: string | undefined,
  status: "APPROVED" | "REJECTED",
  page: number,
  limit = 6,
) => {
  const [data, setData] = useState<Awaited<ReturnType<typeof previewListReviewedDrafts>> | null>(null);
  const [loading, setLoading] = useState(false);

  const enabled = isPreview() && Boolean(reviewerId);

  const refresh = useCallback(async () => {
    if (!enabled || !reviewerId) {
      setData(null);
      return;
    }
    setLoading(true);
    const result = await previewListReviewedDrafts(reviewerId, status, page, limit);
    setData(result);
    setLoading(false);
  }, [enabled, reviewerId, status, page, limit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, refresh };
};
