import client from 'prom-client';
import { IMetricsService } from '../../core/interfaces/metrics.interface.js';

export class PrometheusMetrics implements IMetricsService {
    private cacheOps: client.Counter;
    private searchOps: client.Counter;
    private searchLatency: client.Histogram;
    private esOps: client.Histogram;
    private workerBatch: client.Histogram;
    private workerRecordsProcessed: client.Counter;
    private dlqOps: client.Counter;
    private unknownShapeOps: client.Counter;

    constructor() {
        client.collectDefaultMetrics();

        this.cacheOps = new client.Counter({
            name: 'search_cache_operations_total',
            help: 'Total number of cache operations',
            labelNames: ['operation', 'result'],
        });

        this.searchOps = new client.Counter({
            name: 'search_requests_total',
            help: 'Total number of search requests',
            labelNames: ['status'],
        });

        this.searchLatency = new client.Histogram({
            name: 'search_request_duration_seconds',
            help: 'End-to-end search request latency',
            buckets: [0.05, 0.1, 0.5, 1, 2, 5],
        });

        this.esOps = new client.Histogram({
            name: 'elasticsearch_operation_duration_seconds',
            help: 'Elasticsearch operation latency',
            labelNames: ['operation', 'status'],
            buckets: [0.05, 0.1, 0.5, 1, 2, 5],
        });

        this.workerBatch = new client.Histogram({
            name: 'worker_batch_processing_seconds',
            help: 'Time taken to process kafka batch',
            labelNames: ['status'],
            buckets: [0.1, 0.5, 1, 2, 5, 10],
        });

        this.workerRecordsProcessed = new client.Counter({
            name: 'worker_records_processed_total',
            help: 'Total records processed by the worker, per batch status',
            labelNames: ['status'],
        });

        this.dlqOps = new client.Counter({
            name: 'dlq_messages_pushed_total',
            help: 'Total messages pushed to DLQ',
            labelNames: ['topic'],
        });

        this.unknownShapeOps = new client.Counter({
            name: 'posts_event_unknown_shape_total',
            help: 'Total post events rejected for unknown shape',
            labelNames: ['topic'],
        });
    }

    incrementCacheHit(operation: string): void {
        this.cacheOps.inc({ operation, result: 'hit' });
    }

    incrementCacheMiss(operation: string): void {
        this.cacheOps.inc({ operation, result: 'miss' });
    }

    incrementCacheReadError(operation: string): void {
        this.cacheOps.inc({ operation, result: 'read_error' });
    }

    incrementCacheWriteError(operation: string): void {
        this.cacheOps.inc({ operation, result: 'write_error' });
    }

    incrementSearchCount(status: 'success' | 'error'): void {
        this.searchOps.inc({ status });
    }

    recordSearchLatency(durationSeconds: number): void {
        this.searchLatency.observe(durationSeconds);
    }

    recordEsOperation(
        operation: 'search' | 'bulk_upsert' | 'bulk_delete',
        status: 'success' | 'error',
        durationSeconds: number
    ): void {
        this.esOps.labels({ operation, status }).observe(durationSeconds);
    }

    recordWorkerBatch(
        status: 'success' | 'error',
        durationSeconds: number,
        recordsProcessed: number
    ): void {
        this.workerBatch.labels({ status }).observe(durationSeconds);
        this.workerRecordsProcessed.labels({ status }).inc(recordsProcessed);
    }

    incrementDlqCount(topic: string): void {
        this.dlqOps.inc({ topic });
    }

    incrementUnknownShapeCount(topic: string): void {
        this.unknownShapeOps.inc({ topic });
    }

    getContentType(): string {
        return client.register.contentType;
    }

    async getMetrics(): Promise<string> {
        return client.register.metrics();
    }
}
