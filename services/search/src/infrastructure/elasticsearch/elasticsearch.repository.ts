import { Client } from '@elastic/elasticsearch';
import { ISearchReader, ISearchIndexer } from '../../core/interfaces/repository.interface.js';
import { PostDocument, SearchResult } from '../../core/entities/post.entity.js';
import { ILogger } from '../../core/interfaces/logger.interface.js';
import { IMetricsService } from '../../core/interfaces/metrics.interface.js';
import { BulkPartialFailureError, InfrastructureError } from '../../core/errors/app.error.js';
import type { IConfig } from '../../core/interfaces/config.interface.js';

export type ElasticsearchConfig = IConfig['elasticsearch'];

const ES_MAX_RESULT_WINDOW = 10000;

export const POSTS_INDEX_MAPPING = {
    properties: {
        postId: { type: 'keyword' },
        title: { type: 'text' },
        body: { type: 'text' },
        imageUrl: { type: 'keyword' },
        createdAt: { type: 'date' },
        slug: { type: 'keyword' },
        summary: { type: 'text' },
    },
} as const;

interface BulkFailure {
    id: string;
    status?: number;
    reason?: string;
}

const collectBulkFailures = (
    items: Array<Record<string, unknown>>,
    ids: string[]
): BulkFailure[] => {
    const failures: BulkFailure[] = [];
    items.forEach((action, i) => {
        const operation = Object.keys(action)[0];
        const item = action[operation];
        if (item?.error) {
            failures.push({
                id: ids[i],
                status: item.status,
                reason: typeof item.error === 'object' ? item.error.reason : String(item.error),
            });
        }
    });
    return failures;
};

export class ElasticsearchRepository implements ISearchReader, ISearchIndexer {
    private readonly client: Client;
    private readonly index: string;
    private readonly refreshPolicy: 'false' | 'true' | 'wait_for';

    constructor(
        esConfig: ElasticsearchConfig,
        private readonly logger: ILogger,
        private readonly metrics: IMetricsService
    ) {
        this.index = esConfig.index;
        this.refreshPolicy = esConfig.refreshPolicy;
        this.client = new Client({
            node: esConfig.url,
            tls: { rejectUnauthorized: esConfig.tlsRejectUnauthorized },
            requestTimeout: esConfig.requestTimeoutMs,
            maxRetries: esConfig.maxRetries,
        });
    }

    async ensureIndex(): Promise<void> {
        const exists = await this.client.indices.exists({ index: this.index });
        if (exists) return;
        await this.client.indices.create({
            index: this.index,
            mappings: POSTS_INDEX_MAPPING as unknown as Record<string, unknown>,
        });
        this.logger.info('Elasticsearch index created', { index: this.index });
    }

    async bulkUpsert(documents: PostDocument[]): Promise<void> {
        if (documents.length === 0) return;
        const start = performance.now();

        const operations = documents.flatMap((doc) => [
            { index: { _index: this.index, _id: doc.postId } },
            doc,
        ]);

        try {
            const result = await this.client.bulk({
                operations,
                refresh: this.refreshPolicy,
            });
            const duration = (performance.now() - start) / 1000;
            this.metrics.recordEsOperation('bulk_upsert', 'success', duration);

            if (result.errors) {
                const failures = collectBulkFailures(
                    result.items as Array<Record<string, unknown>>,
                    documents.map((d) => d.postId)
                );
                this.logger.error('Partial Bulk Upsert Failure', { failures });
                throw new BulkPartialFailureError('Partial bulk upsert failure', {
                    operation: 'bulk_upsert',
                    failedIds: failures,
                });
            }
        } catch (err) {
            const duration = (performance.now() - start) / 1000;
            this.metrics.recordEsOperation('bulk_upsert', 'error', duration);
            if (err instanceof BulkPartialFailureError) {
                throw err;
            }
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error('Elasticsearch Bulk Upsert Critical Fail', { error: message });
            throw new InfrastructureError(message);
        }
    }

    async bulkDelete(ids: string[]): Promise<void> {
        if (ids.length === 0) return;
        const start = performance.now();

        const operations = ids.flatMap((id) => [{ delete: { _index: this.index, _id: id } }]);

        try {
            const result = await this.client.bulk({
                operations,
                refresh: this.refreshPolicy,
            });
            const duration = (performance.now() - start) / 1000;
            this.metrics.recordEsOperation('bulk_delete', 'success', duration);

            if (result.errors) {
                const failures = collectBulkFailures(
                    result.items as Array<Record<string, unknown>>,
                    ids
                );
                this.logger.error('Partial Bulk Delete Failure', { failures });
                throw new BulkPartialFailureError('Partial bulk delete failure', {
                    operation: 'bulk_delete',
                    failedIds: failures,
                });
            }
        } catch (err) {
            const duration = (performance.now() - start) / 1000;
            this.metrics.recordEsOperation('bulk_delete', 'error', duration);
            if (err instanceof BulkPartialFailureError) {
                throw err;
            }
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error('Elasticsearch Bulk Delete Critical Fail', { error: message });
            throw new InfrastructureError(message);
        }
    }

    async search(query: string, page: number, limit: number): Promise<SearchResult> {
        const from = (page - 1) * limit;
        if (from < 0) {
            throw new InfrastructureError('Pagination offset (from) must be non-negative');
        }
        if (from + limit > ES_MAX_RESULT_WINDOW) {
            throw new InfrastructureError(
                `Pagination window exceeds ${ES_MAX_RESULT_WINDOW}; use a more selective query`
            );
        }
        const start = performance.now();

        try {
            const result = await this.client.search({
                index: this.index,
                from,
                size: limit,
                query: {
                    multi_match: {
                        query,
                        fields: ['title^3', 'body'],
                        fuzziness: 'AUTO',
                    },
                },
            });

            const duration = (performance.now() - start) / 1000;
            this.metrics.recordEsOperation('search', 'success', duration);

            const hits = result.hits.hits.map((h) => h._source as PostDocument);
            const totalVal = result.hits.total;
            const total = typeof totalVal === 'number' ? totalVal : totalVal?.value || 0;

            return { hits, total };
        } catch (err) {
            const duration = (performance.now() - start) / 1000;
            this.metrics.recordEsOperation('search', 'error', duration);
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error('Search Query Failed', { error: message });
            throw new InfrastructureError(message);
        }
    }

    async checkHealth(): Promise<boolean> {
        try {
            const health = await this.client.cluster.health();
            return health.status !== 'red';
        } catch {
            return false;
        }
    }
}
