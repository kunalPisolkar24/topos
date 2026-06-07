import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ElasticsearchRepository } from '../../infrastructure/elasticsearch/elasticsearch.repository.js';
import { RedisCache } from '../../infrastructure/redis/redis.cache.js';
import { SearchService } from '../../api/services/search.service.js';
import { SAMPLE_POSTS, stubLogger, stubMetrics } from '../helpers/fixtures.js';
import type { ElasticsearchConfig } from '../../infrastructure/elasticsearch/elasticsearch.repository.js';
import type { RedisConfig } from '../../infrastructure/redis/redis.cache.js';
import type { SearchServiceConfig } from '../../api/services/search.service.js';

const TEST_INDEX = 'int-test-search-svc';

let esRepo: ElasticsearchRepository;
let cache: RedisCache;
let searchService: SearchService;

function getEsConfig(): ElasticsearchConfig {
  const url = process.env.INTEGRATION_ES_URL;
  if (!url) throw new Error('INTEGRATION_ES_URL not set');
  return {
    url,
    index: TEST_INDEX,
    tlsRejectUnauthorized: false,
    requestTimeoutMs: 10_000,
    maxRetries: 1,
    refreshPolicy: 'wait_for',
    bulkChunkSize: 100,
  };
}

function getRedisConfig(): RedisConfig {
  const url = process.env.INTEGRATION_REDIS_URL;
  if (!url) throw new Error('INTEGRATION_REDIS_URL not set');
  return {
    url,
    sentinelHosts: undefined,
    sentinelMasterName: 'mymaster',
    password: undefined,
    sentinelPassword: undefined,
    sentinelTls: false,
  };
}

beforeAll(async () => {
  esRepo = new ElasticsearchRepository(getEsConfig(), stubLogger, stubMetrics);
  cache = new RedisCache(getRedisConfig(), stubLogger);

  await esRepo.ensureIndex();
  await cache.connect();

  const config: SearchServiceConfig = {
    defaultTtlSeconds: 60,
    maxQueryLength: 512,
    maxLimit: 50,
  };

  searchService = new SearchService(esRepo, cache, stubLogger, stubMetrics, config);
});

afterAll(async () => {
  await cache.disconnect();
  try {
    const { Client } = await import('@elastic/elasticsearch');
    const esUrl = process.env.INTEGRATION_ES_URL!;
    const client = new Client({ node: esUrl });
    await client.indices.delete({ index: TEST_INDEX });
    await client.close();
  } catch {
    // best-effort cleanup
  }
});

describe('SearchService integration', () => {
  it('searchPosts returns results from ES on cache miss', async () => {
    await esRepo.bulkUpsert(SAMPLE_POSTS);

    const result = await searchService.searchPosts('gamma', 1, 10);

    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.hits.some((h) => h.postId === 'gamma')).toBe(true);
  });

  it('returns cached results on second identical query', async () => {
    const query = 'beta';

    const firstResult = await searchService.searchPosts(query, 1, 10);
    expect(firstResult.total).toBeGreaterThanOrEqual(1);

    await esRepo.bulkDelete([firstResult.hits[0].postId]);

    const secondResult = await searchService.searchPosts(query, 1, 10);
    expect(secondResult.total).toBeGreaterThanOrEqual(1);
  });

  it('different query causes a cache miss', async () => {
    const result = await searchService.searchPosts('unmatched-query-xyz', 1, 10);
    expect(result.total).toBe(0);
    expect(result.hits).toHaveLength(0);
  });

  it('rejects empty query', async () => {
    await expect(searchService.searchPosts('', 1, 10)).rejects.toThrow();
  });

  it('rejects query exceeding max length', async () => {
    const longQuery = 'a'.repeat(513);
    await expect(searchService.searchPosts(longQuery, 1, 10)).rejects.toThrow();
  });

  it('rejects page less than 1', async () => {
    await expect(searchService.searchPosts('test', 0, 10)).rejects.toThrow();
  });

  it('rejects limit greater than maxLimit', async () => {
    await expect(searchService.searchPosts('test', 1, 51)).rejects.toThrow();
  });
});
