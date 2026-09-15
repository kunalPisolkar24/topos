import { isPreviewEnv } from "./env";

export const isPreview = (): boolean => isPreviewEnv;

export const PREVIEW_DISABLED_REASON = "Not available in preview mode";

export const PREVIEW_NOTICE_DISMISSED_KEY = "topos.previewNoticeDismissed";
export const PREVIEW_SEED_VERSION = 1;
export const PREVIEW_DB_NAME = "topos-preview";
export const PREVIEW_DB_VERSION = 1;
