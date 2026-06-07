import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockCounterInc = vi.fn();
const mockCounterLabels = vi.fn().mockReturnValue({ inc: mockCounterInc });
const mockHistogramObserve = vi.fn();
const mockHistogramLabels = vi.fn().mockReturnValue({ observe: mockHistogramObserve });

vi.mock('prom-client', () => {
    class MockCounter {
        inc = mockCounterInc;
        labels = mockCounterLabels;
        constructor() { }
    }
    class MockHistogram {
        observe = mockHistogramObserve;
        labels = mockHistogramLabels;
        constructor() { }
    }
    return {
        default: {
            collectDefaultMetrics: vi.fn(),
            Counter: MockCounter,
            Histogram: MockHistogram,
            register: {
                contentType: 'text/plain',
                metrics: vi.fn().mockResolvedValue('metrics data')
            }
        }
    };
});

import { PrometheusMetrics } from '../prometheus.metrics.js';

describe('PrometheusMetrics', () => {
    let metrics: PrometheusMetrics;

    beforeEach(() => {
        vi.clearAllMocks();
        metrics = new PrometheusMetrics();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('cache operations', () => {
        it('should increment cache hit', () => {
            metrics.incrementCacheHit('searchPosts');
            expect(mockCounterInc).toHaveBeenCalled();
        });

        it('should increment cache miss', () => {
            metrics.incrementCacheMiss('searchPosts');
            expect(mockCounterInc).toHaveBeenCalled();
        });

        it('should increment cache read error', () => {
            metrics.incrementCacheReadError('searchPosts');
            expect(mockCounterInc).toHaveBeenCalled();
        });

        it('should increment cache write error', () => {
            metrics.incrementCacheWriteError('searchPosts');
            expect(mockCounterInc).toHaveBeenCalled();
        });
    });

    describe('search operations', () => {
        it('should increment search count for success', () => {
            metrics.incrementSearchCount('success');
            expect(mockCounterInc).toHaveBeenCalled();
        });

        it('should increment search count for error', () => {
            metrics.incrementSearchCount('error');
            expect(mockCounterInc).toHaveBeenCalled();
        });

        it('should record search latency', () => {
            metrics.recordSearchLatency(0.5);
            expect(mockHistogramObserve).toHaveBeenCalledWith(0.5);
        });
    });

    describe('elasticsearch operations', () => {
        it('should record search operation success', () => {
            metrics.recordEsOperation('search', 'success', 0.1);
            expect(mockHistogramLabels).toHaveBeenCalledWith({ operation: 'search', status: 'success' });
            expect(mockHistogramObserve).toHaveBeenCalledWith(0.1);
        });

        it('should record search operation error', () => {
            metrics.recordEsOperation('search', 'error', 0.2);
            expect(mockHistogramLabels).toHaveBeenCalledWith({ operation: 'search', status: 'error' });
        });

        it('should record bulk_upsert operation', () => {
            metrics.recordEsOperation('bulk_upsert', 'success', 0.3);
            expect(mockHistogramLabels).toHaveBeenCalledWith({ operation: 'bulk_upsert', status: 'success' });
        });

        it('should record bulk_delete operation', () => {
            metrics.recordEsOperation('bulk_delete', 'success', 0.4);
            expect(mockHistogramLabels).toHaveBeenCalledWith({ operation: 'bulk_delete', status: 'success' });
        });
    });

    describe('worker operations', () => {
        it('should record worker batch success', () => {
            metrics.recordWorkerBatch('success', 1.0, 100);
            expect(mockHistogramLabels).toHaveBeenCalledWith({ status: 'success' });
        });

        it('should record worker batch error', () => {
            metrics.recordWorkerBatch('error', 0.5, 0);
            expect(mockHistogramLabels).toHaveBeenCalledWith({ status: 'error' });
        });
    });

    describe('DLQ operations', () => {
        it('should increment DLQ count', () => {
            metrics.incrementDlqCount('posts');
            expect(mockCounterInc).toHaveBeenCalled();
        });
    });

    describe('unknown shape events', () => {
        it('should increment unknown shape count', () => {
            metrics.incrementUnknownShapeCount('posts');
            expect(mockCounterInc).toHaveBeenCalled();
        });
    });

    describe('metrics endpoint', () => {
        it('should return content type', () => {
            const contentType = metrics.getContentType();
            expect(contentType).toBe('text/plain');
        });

        it('should return metrics', async () => {
            const metricsData = await metrics.getMetrics();
            expect(metricsData).toBe('metrics data');
        });
    });
});
