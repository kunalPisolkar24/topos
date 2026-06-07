import type { PostDocument, SearchResult } from '../../core/entities/post.entity.js';
import type { ILogger } from '../../core/interfaces/logger.interface.js';
import type { IMetricsService } from '../../core/interfaces/metrics.interface.js';

export const buildPostDocument = (
  overrides: Partial<PostDocument> = {}
): PostDocument => ({
  postId: 'post-' + crypto.randomUUID().slice(0, 8),
  title: 'Test Post Title',
  body: 'This is the test post body content for search integration tests.',
  imageUrl: null,
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const buildSearchResult = (
  hits: PostDocument[] = [],
  total?: number
): SearchResult => ({
  hits,
  total: total ?? hits.length,
});

export const buildPostEvent = (
  overrides: Record<string, unknown> = {}
): Record<string, unknown> => ({
  PostID: 'event-' + crypto.randomUUID().slice(0, 8),
  Title: 'Event Post Title',
  Body: 'Event post body content from Kafka message.',
  CreatedAt: new Date().toISOString(),
  ImageURL: null,
  ...overrides,
});

export const SAMPLE_POSTS: PostDocument[] = [
  buildPostDocument({
    postId: 'alpha',
    title: 'Alpha Unleashed',
    body: 'The first post about alpha testing.',
    createdAt: '2024-01-01T00:00:00Z',
  }),
  buildPostDocument({
    postId: 'beta',
    title: 'Beta Features',
    body: 'Exploring beta features of the platform.',
    createdAt: '2024-01-02T00:00:00Z',
  }),
  buildPostDocument({
    postId: 'gamma',
    title: 'Gamma Rays',
    body: 'Scientific research on gamma radiation.',
    createdAt: '2024-01-03T00:00:00Z',
  }),
];

export const stubLogger: ILogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  child: () => stubLogger,
};

export const stubMetrics: IMetricsService = {
  incrementCacheHit: () => {},
  incrementCacheMiss: () => {},
  incrementCacheReadError: () => {},
  incrementCacheWriteError: () => {},
  incrementSearchCount: () => {},
  recordSearchLatency: () => {},
  recordEsOperation: () => {},
  recordWorkerBatch: () => {},
  incrementDlqCount: () => {},
  incrementUnknownShapeCount: () => {},
  getContentType: () => 'text/plain',
  getMetrics: async () => '',
};
