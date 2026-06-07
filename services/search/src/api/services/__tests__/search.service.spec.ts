import { describe, it, expect, beforeEach } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';
import { SearchService, type SearchServiceConfig } from '../search.service.js';
import { ISearchReader } from '../../../core/interfaces/repository.interface.js';
import { ICacheService } from '../../../core/interfaces/cache.interface.js';
import { ILogger } from '../../../core/interfaces/logger.interface.js';
import { IMetricsService } from '../../../core/interfaces/metrics.interface.js';
import { PostDocument, SearchResult } from '../../../core/entities/post.entity.js';
import { ValidationError } from '../../../core/errors/app.error.js';

const createMockPostDocument = (overrides: Partial<PostDocument> = {}): PostDocument => ({
    postId: '1',
    title: 'Test Post',
    body: 'Test body content',
    imageUrl: null,
    createdAt: new Date().toISOString(),
    ...overrides,
});

const createMockSearchResult = (
    hits: PostDocument[] = [],
    total?: number
): SearchResult => ({
    hits,
    total: total ?? hits.length,
});

const defaultConfig: SearchServiceConfig = {
    defaultTtlSeconds: 120,
    maxQueryLength: 512,
    maxLimit: 50,
};

describe('SearchService', () => {
    let searchService: SearchService;
    let searchReader: MockProxy<ISearchReader>;
    let cache: MockProxy<ICacheService>;
    let logger: MockProxy<ILogger>;
    let metrics: MockProxy<IMetricsService>;

    beforeEach(() => {
        searchReader = mock<ISearchReader>();
        cache = mock<ICacheService>();
        logger = mock<ILogger>();
        metrics = mock<IMetricsService>();
        searchService = new SearchService(
            searchReader,
            cache,
            logger,
            metrics,
            defaultConfig
        );
    });

    describe('searchPosts', () => {
        it('should return cached results on cache hit', async () => {
            const mockPost = createMockPostDocument({ postId: '1', title: 'Test' });
            const cachedData = createMockSearchResult([mockPost], 1);
            cache.get.mockResolvedValue(JSON.stringify(cachedData));

            const result = await searchService.searchPosts('test', 1, 10);

            expect(result).toEqual(cachedData);
            expect(metrics.incrementCacheHit).toHaveBeenCalledWith('searchPosts');
            expect(searchReader.search).not.toHaveBeenCalled();
        });

        it('should search and cache on cache miss', async () => {
            const mockPost = createMockPostDocument({ postId: '1', title: 'Test' });
            const searchResult = createMockSearchResult([mockPost], 1);
            cache.get.mockResolvedValue(null);
            searchReader.search.mockResolvedValue(searchResult);

            const result = await searchService.searchPosts('test', 1, 10);

            expect(result).toEqual(searchResult);
            expect(metrics.incrementCacheMiss).toHaveBeenCalledWith('searchPosts');
            expect(cache.set).toHaveBeenCalledWith(
                expect.stringContaining('search:'),
                JSON.stringify(searchResult),
                120
            );
            expect(metrics.incrementSearchCount).toHaveBeenCalledWith('success');
        });

        it('uses hashed cache key derived from the query', async () => {
            cache.get.mockResolvedValue(null);
            searchReader.search.mockResolvedValue(createMockSearchResult());

            await searchService.searchPosts('Test Query', 2, 20);

            const call = cache.get.mock.calls[0][0];
            expect(call).toMatch(/^search:q:[a-f0-9]{32}:p:2:l:20$/);
        });

        it('hashes identical queries to the same key regardless of case/whitespace', async () => {
            cache.get.mockResolvedValue(null);
            searchReader.search.mockResolvedValue(createMockSearchResult());

            await searchService.searchPosts('Hello World', 1, 10);
            await searchService.searchPosts('  hello world  ', 1, 10);

            const firstKey = cache.get.mock.calls[0][0];
            const secondKey = cache.get.mock.calls[1][0];
            expect(firstKey).toBe(secondKey);
        });

        it('honours the configured TTL on cache writes', async () => {
            cache.get.mockResolvedValue(null);
            searchReader.search.mockResolvedValue(createMockSearchResult());
            const cfg: SearchServiceConfig = { ...defaultConfig, defaultTtlSeconds: 7 };
            const svc = new SearchService(searchReader, cache, logger, metrics, cfg);

            await svc.searchPosts('test', 1, 10);

            expect(cache.set).toHaveBeenCalledWith(expect.any(String), expect.any(String), 7);
        });

        it('should handle cache read failure gracefully', async () => {
            const searchResult = createMockSearchResult();
            cache.get.mockRejectedValue(new Error('Redis Error'));
            searchReader.search.mockResolvedValue(searchResult);

            const result = await searchService.searchPosts('test', 1, 10);

            expect(result).toEqual(searchResult);
            expect(logger.warn).toHaveBeenCalledWith('Cache read failed', expect.any(Object));
            expect(metrics.incrementCacheReadError).toHaveBeenCalledWith('searchPosts');
        });

        it('should handle cache write failure gracefully', async () => {
            const searchResult = createMockSearchResult();
            cache.get.mockResolvedValue(null);
            searchReader.search.mockResolvedValue(searchResult);
            cache.set.mockRejectedValue(new Error('Redis Error'));

            const result = await searchService.searchPosts('test', 1, 10);

            expect(result).toEqual(searchResult);
            expect(logger.warn).toHaveBeenCalledWith('Cache write failed', expect.any(Object));
            expect(metrics.incrementCacheWriteError).toHaveBeenCalledWith('searchPosts');
        });

        it('evicts the key and falls through on corrupt cached JSON', async () => {
            const searchResult = createMockSearchResult();
            cache.get.mockResolvedValueOnce('not-valid-json');
            searchReader.search.mockResolvedValue(searchResult);

            const result = await searchService.searchPosts('test', 1, 10);

            expect(result).toEqual(searchResult);
            expect(cache.delete).toHaveBeenCalled();
            expect(metrics.incrementCacheReadError).toHaveBeenCalledWith('searchPosts');
            expect(metrics.incrementCacheMiss).not.toHaveBeenCalled();
        });

        it('should record metrics on search error', async () => {
            cache.get.mockResolvedValue(null);
            searchReader.search.mockRejectedValue(new Error('Search Error'));

            await expect(searchService.searchPosts('test', 1, 10)).rejects.toThrow('Search Error');

            expect(metrics.incrementSearchCount).toHaveBeenCalledWith('error');
            expect(metrics.recordSearchLatency).toHaveBeenCalledWith(expect.any(Number));
        });

        it('should record latency for successful search', async () => {
            cache.get.mockResolvedValue(null);
            searchReader.search.mockResolvedValue(createMockSearchResult());

            await searchService.searchPosts('test', 1, 10);

            expect(metrics.recordSearchLatency).toHaveBeenCalledWith(expect.any(Number));
        });

        it('should record latency for cache hit', async () => {
            cache.get.mockResolvedValue(JSON.stringify(createMockSearchResult()));

            await searchService.searchPosts('test', 1, 10);

            expect(metrics.recordSearchLatency).toHaveBeenCalledWith(expect.any(Number));
        });
    });

    describe('input validation', () => {
        it.each([
            ['empty string', '', 1, 10],
            ['whitespace only is rejected as empty after validation', '   ', 1, 10],
        ])('rejects query "%s"', async (_label, query, page, limit) => {
            await expect(searchService.searchPosts(query, page, limit)).rejects.toThrow(
                ValidationError
            );
        });

        it('rejects query longer than maxQueryLength', async () => {
            const long = 'a'.repeat(defaultConfig.maxQueryLength + 1);
            await expect(searchService.searchPosts(long, 1, 10)).rejects.toThrow(ValidationError);
        });

        it('rejects page < 1', async () => {
            await expect(searchService.searchPosts('test', 0, 10)).rejects.toThrow(ValidationError);
        });

        it('rejects limit < 1', async () => {
            await expect(searchService.searchPosts('test', 1, 0)).rejects.toThrow(ValidationError);
        });

        it('rejects limit > maxLimit', async () => {
            await expect(searchService.searchPosts('test', 1, 51)).rejects.toThrow(ValidationError);
        });

        it('does not call the search reader on validation failure', async () => {
            await expect(searchService.searchPosts('', 1, 10)).rejects.toThrow(ValidationError);
            expect(searchReader.search).not.toHaveBeenCalled();
        });
    });
});
