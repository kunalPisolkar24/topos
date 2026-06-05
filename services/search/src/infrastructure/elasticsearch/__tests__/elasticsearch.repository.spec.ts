import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';
import { ILogger } from '../../../core/interfaces/logger.interface.js';
import { IMetricsService } from '../../../core/interfaces/metrics.interface.js';
import { BulkPartialFailureError, InfrastructureError } from '../../../core/errors/app.error.js';
import type { ElasticsearchConfig } from '../elasticsearch.repository.js';

const mockBulk = vi.fn();
const mockSearch = vi.fn();
const mockClusterHealth = vi.fn();
const mockIndicesExists = vi.fn();
const mockIndicesCreate = vi.fn();

vi.mock('@elastic/elasticsearch', () => {
    return {
        Client: class MockClient {
            bulk = mockBulk;
            search = mockSearch;
            cluster = { health: mockClusterHealth };
            indices = {
                exists: mockIndicesExists,
                create: mockIndicesCreate,
            };
        },
    };
});

import { ElasticsearchRepository } from '../elasticsearch.repository.js';

const esConfig: ElasticsearchConfig = {
    url: 'http://localhost:9200',
    index: 'test_index',
    tlsRejectUnauthorized: true,
    requestTimeoutMs: 30000,
    maxRetries: 3,
    refreshPolicy: 'wait_for',
    bulkChunkSize: 1000,
};

describe('ElasticsearchRepository', () => {
    let repository: ElasticsearchRepository;
    let logger: MockProxy<ILogger>;
    let metrics: MockProxy<IMetricsService>;

    beforeEach(() => {
        vi.clearAllMocks();
        logger = mock<ILogger>();
        metrics = mock<IMetricsService>();
        repository = new ElasticsearchRepository(esConfig, logger, metrics);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('search', () => {
        it('should search successfully', async () => {
            mockSearch.mockResolvedValue({
                hits: {
                    total: { value: 1 },
                    hits: [{ _source: { postId: '1', title: 'Test' } }],
                },
            });

            const result = await repository.search('query', 1, 10);

            expect(result.hits).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(metrics.recordEsOperation).toHaveBeenCalledWith(
                'search',
                'success',
                expect.any(Number)
            );
        });

        it('should handle numeric total in search results', async () => {
            mockSearch.mockResolvedValue({
                hits: {
                    total: 5,
                    hits: [{ _source: { postId: '1', title: 'Test' } }],
                },
            });

            const result = await repository.search('query', 1, 10);

            expect(result.total).toBe(5);
        });

        it('should handle search errors', async () => {
            mockSearch.mockRejectedValue(new Error('Fail'));

            await expect(repository.search('q', 1, 10)).rejects.toThrow('Fail');
            expect(metrics.recordEsOperation).toHaveBeenCalledWith(
                'search',
                'error',
                expect.any(Number)
            );
        });

        it('should calculate correct offset for pagination', async () => {
            mockSearch.mockResolvedValue({
                hits: {
                    total: { value: 100 },
                    hits: [],
                },
            });

            await repository.search('query', 3, 20);

            expect(mockSearch).toHaveBeenCalledWith(
                expect.objectContaining({
                    from: 40,
                    size: 20,
                })
            );
        });
    });

    describe('bulkUpsert', () => {
        it('should bulk upsert successfully', async () => {
            mockBulk.mockResolvedValue({ errors: false, items: [] });
            const docs = [
                { postId: '1', title: 'T', body: 'B', createdAt: '', imageUrl: null },
            ];

            await repository.bulkUpsert(docs);

            expect(mockBulk).toHaveBeenCalled();
            expect(metrics.recordEsOperation).toHaveBeenCalledWith(
                'bulk_upsert',
                'success',
                expect.any(Number)
            );
        });

        it('should return early for empty documents array', async () => {
            await repository.bulkUpsert([]);

            expect(mockBulk).not.toHaveBeenCalled();
        });

        it('should throw BulkPartialFailureError on partial bulk upsert errors', async () => {
            mockBulk.mockResolvedValue({
                errors: true,
                items: [{ index: { error: { reason: 'Mapping Error' }, status: 400 } }],
            });
            const docs = [
                { postId: '1', title: 'T', body: 'B', createdAt: '', imageUrl: null },
            ];

            await expect(repository.bulkUpsert(docs)).rejects.toBeInstanceOf(
                BulkPartialFailureError
            );
            expect(logger.error).toHaveBeenCalledWith(
                'Partial Bulk Upsert Failure',
                expect.objectContaining({ failures: expect.any(Array) })
            );
        });

        it('passes refresh policy from config to bulk calls', async () => {
            mockBulk.mockResolvedValue({ errors: false, items: [] });
            const docs = [
                { postId: '1', title: 'T', body: 'B', createdAt: '', imageUrl: null },
            ];

            await repository.bulkUpsert(docs);

            expect(mockBulk).toHaveBeenCalledWith(
                expect.objectContaining({ refresh: 'wait_for' })
            );
        });

        it('should handle bulk upsert critical failure', async () => {
            mockBulk.mockRejectedValue(new Error('Critical Error'));
            const docs = [
                { postId: '1', title: 'T', body: 'B', createdAt: '', imageUrl: null },
            ];

            await expect(repository.bulkUpsert(docs)).rejects.toThrow('Critical Error');
            expect(metrics.recordEsOperation).toHaveBeenCalledWith(
                'bulk_upsert',
                'error',
                expect.any(Number)
            );
            expect(logger.error).toHaveBeenCalledWith(
                'Elasticsearch Bulk Upsert Critical Fail',
                expect.any(Object)
            );
        });
    });

    describe('bulkDelete', () => {
        it('should bulk delete successfully', async () => {
            mockBulk.mockResolvedValue({ errors: false, items: [] });

            await repository.bulkDelete(['1', '2']);

            expect(mockBulk).toHaveBeenCalled();
            expect(metrics.recordEsOperation).toHaveBeenCalledWith(
                'bulk_delete',
                'success',
                expect.any(Number)
            );
        });

        it('should return early for empty ids array', async () => {
            await repository.bulkDelete([]);

            expect(mockBulk).not.toHaveBeenCalled();
        });

        it('should handle bulk delete failure', async () => {
            mockBulk.mockRejectedValue(new Error('Delete Error'));

            await expect(repository.bulkDelete(['1'])).rejects.toThrow('Delete Error');
            expect(metrics.recordEsOperation).toHaveBeenCalledWith(
                'bulk_delete',
                'error',
                expect.any(Number)
            );
        });

        it('should throw BulkPartialFailureError on partial bulk delete errors', async () => {
            mockBulk.mockResolvedValue({
                errors: true,
                items: [{ delete: { error: { reason: 'Not Found' }, status: 404 } }],
            });

            await expect(repository.bulkDelete(['1'])).rejects.toBeInstanceOf(
                BulkPartialFailureError
            );
        });
    });

    describe('ensureIndex', () => {
        it('should skip create when index exists', async () => {
            mockIndicesExists.mockResolvedValue(true);

            await repository.ensureIndex();

            expect(mockIndicesExists).toHaveBeenCalledWith({ index: 'test_index' });
            expect(mockIndicesCreate).not.toHaveBeenCalled();
        });

        it('should create index with mapping when missing', async () => {
            mockIndicesExists.mockResolvedValue(false);
            mockIndicesCreate.mockResolvedValue({});

            await repository.ensureIndex();

            expect(mockIndicesCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    index: 'test_index',
                    mappings: expect.objectContaining({
                        properties: expect.objectContaining({
                            postId: { type: 'keyword' },
                        }),
                    }),
                })
            );
        });
    });

    describe('search pagination safety', () => {
        it('rejects offset beyond max_result_window', async () => {
            await expect(repository.search('q', 200, 60)).rejects.toBeInstanceOf(
                InfrastructureError
            );
            expect(mockSearch).not.toHaveBeenCalled();
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
