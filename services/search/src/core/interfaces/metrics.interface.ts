export interface IMetricsService {
    incrementCacheHit(operation: string): void;
    incrementCacheMiss(operation: string): void;
    incrementCacheReadError(operation: string): void;
    incrementCacheWriteError(operation: string): void;
    incrementSearchCount(status: 'success' | 'error'): void;
    recordSearchLatency(durationSeconds: number): void;
    recordEsOperation(
        operation: 'search' | 'bulk_upsert' | 'bulk_delete',
        status: 'success' | 'error',
        durationSeconds: number
    ): void;
    recordWorkerBatch(
        status: 'success' | 'error',
        durationSeconds: number,
        recordsProcessed: number
    ): void;
    incrementDlqCount(topic: string): void;
    incrementUnknownShapeCount(topic: string): void;
    getContentType(): string;
    getMetrics(): Promise<string>;
}
