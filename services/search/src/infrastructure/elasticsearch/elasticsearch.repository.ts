import { Client } from '@elastic/elasticsearch';
import { ISearchReader, ISearchIndexer } from '../../core/interfaces/repository.interface.js';
import { PostDocument, SearchResult } from '../../core/entities/post.entity.js';
import { ILogger } from '../../core/interfaces/logger.interface.js';
import { IMetricsService } from '../../core/interfaces/metrics.interface.js';
import { InfrastructureError } from '../../core/errors/app.error.js';
import type { IConfig } from '../../core/interfaces/config.interface.js';

export type ElasticsearchConfig = IConfig['elasticsearch'];

export class ElasticsearchRepository implements ISearchReader, ISearchIndexer {
    private readonly client: Client;
    private readonly index: string;

    constructor(
        esConfig: ElasticsearchConfig,
        private readonly logger: ILogger,
        private readonly metrics: IMetricsService
    ) {
        this.index = esConfig.index;
        this.client = new Client({
            node: esConfig.url,
            tls: { rejectUnauthorized: esConfig.tlsRejectUnauthorized },
            requestTimeout: esConfig.requestTimeoutMs,
            maxRetries: esConfig.maxRetries,
        });
    }

    async bulkUpsert(documents: PostDocument[]): Promise<void> {
        if (documents.length === 0) return;
        const start = performance.now();

        const operations = documents.flatMap((doc) => [
            { index: { _index: this.index, _id: doc.postId } },
            doc,
        ]);

        try {
            const result = await this.client.bulk({ operations });
            const duration = (performance.now() - start) / 1000;
            this.metrics.recordEsOperation('bulk_upsert', 'success', duration);

            if (result.errors) {
                const erroredDocuments: Array<{
                    status: number | undefined;
                    error: unknown;
                    docId: string;
                }> = [];
                result.items.forEach((action: Record<string, any>, i: number) => {
                    const operation = Object.keys(action)[0];
                    if (action[operation].error) {
                        erroredDocuments.push({
                            status: action[operation].status,
                            error: action[operation].error,
                            docId: documents[i].postId,
                        });
                    }
                });
                this.logger.error('Partial Bulk Upsert Failure', { errors: erroredDocuments });
            }
        } catch (err: any) {
            const duration = (performance.now() - start) / 1000;
            this.metrics.recordEsOperation('bulk_upsert', 'error', duration);
            this.logger.error('Elasticsearch Bulk Upsert Critical Fail', { error: err.message });
            throw new InfrastructureError(err.message);
        }
    }

    async bulkDelete(ids: string[]): Promise<void> {
        if (ids.length === 0) return;
        const start = performance.now();

        const operations = ids.flatMap((id) => [{ delete: { _index: this.index, _id: id } }]);

        try {
            await this.client.bulk({ operations });
            const duration = (performance.now() - start) / 1000;
            this.metrics.recordEsOperation('bulk_delete', 'success', duration);
        } catch (err: any) {
            const duration = (performance.now() - start) / 1000;
            this.metrics.recordEsOperation('bulk_delete', 'error', duration);
            this.logger.error('Elasticsearch Bulk Delete Critical Fail', { error: err.message });
            throw new InfrastructureError(err.message);
        }
    }

    async search(query: string, page: number, limit: number): Promise<SearchResult> {
        const from = (page - 1) * limit;
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

            const hits = result.hits.hits.map((h: any) => h._source as PostDocument);
            const totalVal = result.hits.total;
            const total = typeof totalVal === 'number' ? totalVal : totalVal?.value || 0;

            return { hits, total };
        } catch (err: any) {
            const duration = (performance.now() - start) / 1000;
            this.metrics.recordEsOperation('search', 'error', duration);
            this.logger.error('Search Query Failed', { error: err.message });
            throw new InfrastructureError(err.message);
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
