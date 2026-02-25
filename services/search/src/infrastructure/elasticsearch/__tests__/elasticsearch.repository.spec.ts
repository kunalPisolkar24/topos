import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';
import { ILogger } from '../../../core/interfaces/logger.interface.js';
import { IMetricsService } from '../../../core/interfaces/metrics.interface.js';

vi.mock('../../../config/index.js', () => ({
  getSharedConfig: () => ({
    ELASTICSEARCH_URL: 'http://localhost:9200',
    ELASTICSEARCH_INDEX: 'test_index',
    NODE_ENV: 'test',
    REDIS_SENTINEL_HOSTS: 'localhost:26379',
    REDIS_MASTER_NAME: 'mymaster'
  })
}));

const mockBulk = vi.fn();
const mockSearch = vi.fn();
const mockClusterHealth = vi.fn();

vi.mock('@elastic/elasticsearch', () => {
  return {
    Client: class MockClient {
      bulk = mockBulk;
      search = mockSearch;
      cluster = { health: mockClusterHealth };
    }
  };
});

import { ElasticsearchRepository } from '../elasticsearch.repository.js';

describe('ElasticsearchRepository', () => {
  let repository: ElasticsearchRepository;
  let logger: MockProxy<ILogger>;
  let metrics: MockProxy<IMetricsService>;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = mock<ILogger>();
    metrics = mock<IMetricsService>();
    repository = new ElasticsearchRepository(logger, metrics);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('search', () => {
    it('should search successfully', async () => {
      mockSearch.mockResolvedValue({
        hits: {
          total: { value: 1 },
          hits: [{ _source: { postId: '1', title: 'Test' } }]
        }
      });

      const result = await repository.search('query', 1, 10);

      expect(result.hits).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(metrics.recordEsOperation).toHaveBeenCalledWith('search', 'success', expect.any(Number));
    });

    it('should handle numeric total in search results', async () => {
      mockSearch.mockResolvedValue({
        hits: {
          total: 5,
          hits: [{ _source: { postId: '1', title: 'Test' } }]
        }
      });

      const result = await repository.search('query', 1, 10);

      expect(result.total).toBe(5);
    });

    it('should handle search errors', async () => {
      mockSearch.mockRejectedValue(new Error('Fail'));

      await expect(repository.search('q', 1, 10)).rejects.toThrow('Fail');
      expect(metrics.recordEsOperation).toHaveBeenCalledWith('search', 'error', expect.any(Number));
    });

    it('should calculate correct offset for pagination', async () => {
      mockSearch.mockResolvedValue({
        hits: {
          total: { value: 100 },
          hits: []
        }
      });

      await repository.search('query', 3, 20);

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 40,
          size: 20
        })
      );
    });
  });

  describe('bulkUpsert', () => {
    it('should bulk upsert successfully', async () => {
      mockBulk.mockResolvedValue({ errors: false, items: [] });
      const docs = [{ postId: '1', title: 'T', body: 'B', createdAt: '', imageUrl: null }];

      await repository.bulkUpsert(docs);

      expect(mockBulk).toHaveBeenCalled();
      expect(metrics.recordEsOperation).toHaveBeenCalledWith('bulk_upsert', 'success', expect.any(Number));
    });

    it('should return early for empty documents array', async () => {
      await repository.bulkUpsert([]);

      expect(mockBulk).not.toHaveBeenCalled();
    });

    it('should log partial bulk errors', async () => {
      mockBulk.mockResolvedValue({
        errors: true,
        items: [{ index: { error: 'Mapping Error', status: 400 } }]
      });
      const docs = [{ postId: '1', title: 'T', body: 'B', createdAt: '', imageUrl: null }];

      await repository.bulkUpsert(docs);

      expect(logger.error).toHaveBeenCalledWith('Partial Bulk Upsert Failure', expect.any(Object));
    });

    it('should handle bulk upsert critical failure', async () => {
      mockBulk.mockRejectedValue(new Error('Critical Error'));
      const docs = [{ postId: '1', title: 'T', body: 'B', createdAt: '', imageUrl: null }];

      await expect(repository.bulkUpsert(docs)).rejects.toThrow('Critical Error');
      expect(metrics.recordEsOperation).toHaveBeenCalledWith('bulk_upsert', 'error', expect.any(Number));
      expect(logger.error).toHaveBeenCalledWith('Elasticsearch Bulk Upsert Critical Fail', expect.any(Object));
    });
  });

  describe('bulkDelete', () => {
    it('should bulk delete successfully', async () => {
      mockBulk.mockResolvedValue({ errors: false, items: [] });

      await repository.bulkDelete(['1', '2']);

      expect(mockBulk).toHaveBeenCalled();
      expect(metrics.recordEsOperation).toHaveBeenCalledWith('bulk_delete', 'success', expect.any(Number));
    });

    it('should return early for empty ids array', async () => {
      await repository.bulkDelete([]);

      expect(mockBulk).not.toHaveBeenCalled();
    });

    it('should handle bulk delete failure', async () => {
      mockBulk.mockRejectedValue(new Error('Delete Error'));

      await expect(repository.bulkDelete(['1'])).rejects.toThrow('Delete Error');
      expect(metrics.recordEsOperation).toHaveBeenCalledWith('bulk_delete', 'error', expect.any(Number));
    });
  });

  describe('checkHealth', () => {
    it('should return true for green status', async () => {
      mockClusterHealth.mockResolvedValue({ status: 'green' });

      const healthy = await repository.checkHealth();

      expect(healthy).toBe(true);
    });

    it('should return true for yellow status', async () => {
      mockClusterHealth.mockResolvedValue({ status: 'yellow' });

      const healthy = await repository.checkHealth();

      expect(healthy).toBe(true);
    });

    it('should return false for red status', async () => {
      mockClusterHealth.mockResolvedValue({ status: 'red' });

      const unhealthy = await repository.checkHealth();

      expect(unhealthy).toBe(false);
    });

    it('should return false on error', async () => {
      mockClusterHealth.mockRejectedValue(new Error('Connection Error'));

      const unhealthy = await repository.checkHealth();

      expect(unhealthy).toBe(false);
    });
  });
});
