import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ElasticsearchRepository } from '../../infrastructure/elasticsearch/elasticsearch.repository.js';
import { SAMPLE_POSTS, stubLogger, stubMetrics } from '../helpers/fixtures.js';
import type { ElasticsearchConfig } from '../../infrastructure/elasticsearch/elasticsearch.repository.js';

const TEST_INDEX = 'int-test-posts';

let repository: ElasticsearchRepository;

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

beforeAll(async () => {
  repository = new ElasticsearchRepository(getEsConfig(), stubLogger, stubMetrics);
  await repository.ensureIndex();
});

afterAll(async () => {
  try {
    const { Client } = await import('@elastic/elasticsearch');
    const esUrl = process.env.INTEGRATION_ES_URL!;
    const client = new Client({ node: esUrl });
    await client.indices.delete({ index: TEST_INDEX });
    await client.close();
  } catch {
    // cleanup is best-effort
  }
});

describe('ElasticsearchRepository integration', () => {
  it('ensureIndex creates the index', async () => {
    await expect(repository.ensureIndex()).resolves.toBeUndefined();
  });

  it('bulkUpsert indexes documents and search returns them', async () => {
    await repository.bulkUpsert([SAMPLE_POSTS[0]]);

    const result = await repository.search('alpha', 1, 10);
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.hits.some((h) => h.postId === 'alpha')).toBe(true);
  });

  it('search returns multiple matching documents', async () => {
    await repository.bulkUpsert(SAMPLE_POSTS);

    const result = await repository.search('beta', 1, 10);
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.hits.some((h) => h.postId === 'beta')).toBe(true);
  });

  it('search respects pagination', async () => {
    const resultPage1 = await repository.search('post', 1, 1);
    expect(resultPage1.hits.length).toBeLessThanOrEqual(1);

    const resultPage2 = await repository.search('post', 2, 1);
    expect(resultPage2.hits.length).toBeLessThanOrEqual(1);
  });

  it('search title field is boosted over body', async () => {
    await repository.bulkUpsert([
      SAMPLE_POSTS[0],
      {
        ...SAMPLE_POSTS[1],
        title: 'irrelevant title',
        body: 'alpha is mentioned only here in the body text',
      },
    ]);

    const result = await repository.search('alpha', 1, 10);
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.hits[0].postId).toBe('alpha');
  });

  it('bulkDelete removes documents', async () => {
    await repository.bulkDelete(['alpha']);

    const result = await repository.search('alpha', 1, 10);
    expect(result.hits.some((h) => h.postId === 'alpha')).toBe(false);
  });

  it('rejects pagination beyond max result window', async () => {
    await expect(
      repository.search('test', 200, 60)
    ).rejects.toThrow();
  });

  it('checkHealth returns true for a running cluster', async () => {
    const healthy = await repository.checkHealth();
    expect(healthy).toBe(true);
  });

  it('bulkUpsert with empty array is a no-op', async () => {
    await expect(repository.bulkUpsert([])).resolves.toBeUndefined();
  });

  it('bulkDelete with empty array is a no-op', async () => {
    await expect(repository.bulkDelete([])).resolves.toBeUndefined();
  });
});
