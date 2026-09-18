import { isPreviewEnv } from "./env";

export const isPreview = (): boolean => isPreviewEnv;

export const PREVIEW_DISABLED_REASON = "Not available in preview mode";

export const PREVIEW_NOTICE_DISMISSED_KEY = "topos.previewNoticeDismissed";

export const previewNoticeDismissedKey = (userId?: string | null): string =>
  userId ? `${PREVIEW_NOTICE_DISMISSED_KEY}.${userId}` : PREVIEW_NOTICE_DISMISSED_KEY;
export const PREVIEW_SEED_VERSION = 4;
export const PREVIEW_DB_NAME = "topos-preview";
export const PREVIEW_DB_VERSION = 3;
