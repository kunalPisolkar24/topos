import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';
import { SearchService } from '../search.service.js';
import { ISearchReader } from '../../../core/interfaces/repository.interface.js';
import { ICacheService } from '../../../core/interfaces/cache.interface.js';
import { ILogger } from '../../../core/interfaces/logger.interface.js';
import { IMetricsService } from '../../../core/interfaces/metrics.interface.js';

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
    searchService = new SearchService(searchReader, cache, logger, metrics);
  });

  describe('searchPosts', () => {
    it('should return cached results on cache hit', async () => {
      const cachedData = { hits: [{ postId: '1', title: 'Test' }], total: 1 };
      cache.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await searchService.searchPosts('test', 1, 10);

      expect(result).toEqual(cachedData);
      expect(metrics.incrementCacheHit).toHaveBeenCalledWith('searchPosts');
      expect(searchReader.search).not.toHaveBeenCalled();
    });

    it('should search and cache on cache miss', async () => {
      const searchResult = { hits: [{ postId: '1', title: 'Test' }], total: 1 };
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

    it('should generate correct cache key', async () => {
      cache.get.mockResolvedValue(null);
      searchReader.search.mockResolvedValue({ hits: [], total: 0 });

      await searchService.searchPosts('Test Query', 2, 20);

      expect(cache.get).toHaveBeenCalledWith('search:q:test query:p:2:l:20');
    });

    it('should handle cache read failure gracefully', async () => {
      const searchResult = { hits: [], total: 0 };
      cache.get.mockRejectedValue(new Error('Redis Error'));
      searchReader.search.mockResolvedValue(searchResult);

      const result = await searchService.searchPosts('test', 1, 10);

      expect(result).toEqual(searchResult);
      expect(logger.warn).toHaveBeenCalledWith('Cache read failed', expect.any(Object));
    });

    it('should handle cache write failure gracefully', async () => {
      const searchResult = { hits: [], total: 0 };
      cache.get.mockResolvedValue(null);
      searchReader.search.mockResolvedValue(searchResult);
      cache.set.mockRejectedValue(new Error('Redis Error'));

      const result = await searchService.searchPosts('test', 1, 10);

      expect(result).toEqual(searchResult);
      expect(logger.warn).toHaveBeenCalledWith('Cache write failed', expect.any(Object));
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
      searchReader.search.mockResolvedValue({ hits: [], total: 0 });

      await searchService.searchPosts('test', 1, 10);

      expect(metrics.recordSearchLatency).toHaveBeenCalledWith(expect.any(Number));
    });

    it('should record latency for cache hit', async () => {
      cache.get.mockResolvedValue(JSON.stringify({ hits: [], total: 0 }));

      await searchService.searchPosts('test', 1, 10);

      expect(metrics.recordSearchLatency).toHaveBeenCalledWith(expect.any(Number));
    });
  });
});