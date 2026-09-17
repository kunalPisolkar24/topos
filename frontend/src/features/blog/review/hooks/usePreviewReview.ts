import { useCallback, useEffect, useState } from "react";
import { isPreview } from "@/shared/config/preview";
import { previewDB } from "@/mocks/preview/preview-db";
import {
  previewGetDraftReview,
  previewGetPostApproval,
  previewListReviewedDrafts,
} from "@/mocks/preview/preview-store";
import type { MockDraft, MockUser } from "@/mocks/data";

type DraftReviewMeta = {
  reviewedById: string | null;
  reviewedAt: string | null;
  rejectionNote: string | null;
};

type PostApproval = {
  approvedById: string | null;
  reviewedAt: string | null;
};

export const usePreviewDraftReview = (draftId?: string | null) => {
  const [meta, setMeta] = useState<DraftReviewMeta | null>(null);

  const refresh = useCallback(async () => {
    if (!isPreview() || !draftId) {
      setMeta(null);
      return;
    }
    const m = await previewGetDraftReview(draftId);
    setMeta(m);
  }, [draftId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { meta, refresh };
};

export const usePreviewPostApproval = (postId?: string | null) => {
  const [approval, setApproval] = useState<PostApproval | null>(null);

  const refresh = useCallback(async () => {
    if (!isPreview() || !postId) {
      setApproval(null);
      return;
    }
    const a = await previewGetPostApproval(postId);
    setApproval(a);
  }, [postId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { approval, refresh };
};

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

export const usePreviewReviewerIdentity = (reviewerId?: string | null) => {
  const [user, setUser] = useState<MockUser | null>(null);

  const refresh = useCallback(async () => {
    if (!isPreview() || !reviewerId) {
      setUser(null);
      return;
    }
    const u = await previewDB.get<MockUser>("users", reviewerId);
    setUser(u ?? null);
  }, [reviewerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { user, refresh };
};

export type PreviewDraftWithReview = MockDraft & {
  reviewedById: string | null;
  reviewedAt: string | null;
  rejectionNote: string | null;
};
