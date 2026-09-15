// feed-attribution remembers which recommendation feed (mode) a post
// was shown in, so the view recorded on the blog detail page can be
// attributed to that feed. The For You feed writes one entry per
// rendered card; the viewer reads and clears it when reporting the
// view. Like and save interactions read the mode from the feed context
// directly, so they only need this handoff.

import type { RecommendMode } from "@/shared/graphql/content-documents";
import { browserSessionStorage, type StoragePort } from "@/shared/lib/storage";

const FEED_MODE_KEY_PREFIX = "topos.feedMode.";

const FEED_MODES: ReadonlySet<string> = new Set<RecommendMode>([
  "DEFAULT",
  "SURPRISE",
]);

let storage: StoragePort = browserSessionStorage;

export function setFeedAttributionStorage(port: StoragePort): void {
  storage = port;
}

// test-only
export function getFeedAttributionStorage(): StoragePort {
  return storage;
}

// markFeedMode remembers the feed mode a post was displayed in. It is
// best-effort: a full or disabled storage never breaks the feed.
export function markFeedMode(postId: string, mode: RecommendMode): void {
  storage.setItem(FEED_MODE_KEY_PREFIX + postId, mode);
}

// takeFeedMode reads and clears the stored feed mode for a post, so the
// view event can carry it. Unknown values are treated as no attribution.
export function takeFeedMode(postId: string): RecommendMode | null {
  const mode = storage.getItem(FEED_MODE_KEY_PREFIX + postId);
  storage.removeItem(FEED_MODE_KEY_PREFIX + postId);
  return mode !== null && FEED_MODES.has(mode) ? (mode as RecommendMode) : null;
}

export function resetFeedAttributionForTests(): void {
  if (storage.length === undefined || !storage.key) {
    return;
  }
  const keys: string[] = [];
  for (let i = 0; i < (storage.length ?? 0); i += 1) {
    const key = storage.key(i);
    if (key?.startsWith(FEED_MODE_KEY_PREFIX)) {
      keys.push(key);
    }
  }
  keys.forEach((key) => storage.removeItem(key));
}