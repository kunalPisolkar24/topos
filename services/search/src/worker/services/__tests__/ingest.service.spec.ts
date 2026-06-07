import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';
import { EachBatchPayload } from 'kafkajs';
import { IngestService } from '../ingest.service.js';
import { ISearchIndexer } from '../../../core/interfaces/repository.interface.js';
import { IDlqProducer } from '../../../core/interfaces/message-broker.interface.js';
import { ILogger } from '../../../core/interfaces/logger.interface.js';
import { IMetricsService } from '../../../core/interfaces/metrics.interface.js';
import { BulkPartialFailureError } from '../../../core/errors/app.error.js';

describe('IngestService', () => {
    let ingestService: IngestService;
    let indexer: MockProxy<ISearchIndexer>;
    let dlqProducer: MockProxy<IDlqProducer>;
    let logger: MockProxy<ILogger>;
    let metrics: MockProxy<IMetricsService>;

    beforeEach(() => {
        indexer = mock<ISearchIndexer>();
        dlqProducer = mock<IDlqProducer>();
        logger = mock<ILogger>();
        metrics = mock<IMetricsService>();
        ingestService = new IngestService(indexer, dlqProducer, logger, metrics);
    });

    const createMockPayload = (messages: any[]): EachBatchPayload => ({
        batch: {
            topic: 'posts',
            partition: 0,
            highWatermark: '100',
            messages: messages.map((m, i) => ({
                key: m.key ? Buffer.from(m.key) : null,
                value: m.value ? Buffer.from(JSON.stringify(m.value)) : null,
                timestamp: Date.now().toString(),
                attributes: 0,
                offset: i.toString(),
                headers: {}
            })),
            isEmpty: () => false,
            firstOffset: () => '0',
            lastOffset: () => messages.length.toString(),
            offsetLag: () => '0',
            offsetLagLow: () => '0'
        },
        resolveOffset: vi.fn(),
        heartbeat: vi.fn(),
        commitOffsetsIfNecessary: vi.fn(),
        uncommittedOffsets: vi.fn(),
        isRunning: () => true,
        isStale: () => false,
        pause: vi.fn(),
    });

    describe('processBatch', () => {
        it('should upsert valid documents', async () => {
            const validDoc = {
                PostID: '123',
                Title: 'Title',
                Body: 'Body',
                CreatedAt: '2023-01-01',
                ImageURL: null
            };

            const payload = createMockPayload([{ value: validDoc }]);

            await ingestService.processBatch(payload);

            expect(indexer.bulkUpsert).toHaveBeenCalledWith(expect.arrayContaining([
                expect.objectContaining({ postId: '123' })
            ]));
            expect(metrics.recordWorkerBatch).toHaveBeenCalledWith('success', expect.any(Number), 1);
            expect(payload.resolveOffset).toHaveBeenCalled();
        });

        it('should upsert documents with optional fields', async () => {
            const validDoc = {
                PostID: '123',
                Title: 'Title',
                Body: 'Body',
                CreatedAt: '2023-01-01',
                ImageURL: 'http://example.com/image.jpg',
                Slug: 'test-slug',
                Summary: 'Test summary'
            };

            const payload = createMockPayload([{ value: validDoc }]);

            await ingestService.processBatch(payload);

            expect(indexer.bulkUpsert).toHaveBeenCalledWith(expect.arrayContaining([
                expect.objectContaining({
                    postId: '123',
                    slug: 'test-slug',
                    summary: 'Test summary',
                    imageUrl: 'http://example.com/image.jpg'
                })
            ]));
        });

        it('should delete documents with empty value (tombstone)', async () => {
            const payload = createMockPayload([{ key: '123', value: null }]);

            await ingestService.processBatch(payload);

            expect(indexer.bulkDelete).toHaveBeenCalledWith(['123']);
            expect(metrics.recordWorkerBatch).toHaveBeenCalledWith('success', expect.any(Number), 1);
        });

        it('should skip tombstone messages without key', async () => {
            const payload = createMockPayload([{ key: null, value: null }]);

            await ingestService.processBatch(payload);

            expect(indexer.bulkDelete).not.toHaveBeenCalled();
            expect(indexer.bulkUpsert).not.toHaveBeenCalled();
        });

        it('should send invalid documents to DLQ', async () => {
            const invalidDoc = { PostID: '123' };
            const payload = createMockPayload([{ key: '123', value: invalidDoc }]);

            await ingestService.processBatch(payload);

            expect(indexer.bulkUpsert).not.toHaveBeenCalled();
            expect(dlqProducer.publish).toHaveBeenCalledWith(expect.objectContaining({
                originalTopic: 'posts',
                key: '123'
            }));
            expect(metrics.incrementDlqCount).toHaveBeenCalledWith('posts');
        });

        it('should handle batch failure', async () => {
            const validDoc = {
                PostID: '123',
                Title: 'Title',
                Body: 'Body',
                CreatedAt: '2023-01-01'
            };
            const payload = createMockPayload([{ value: validDoc }]);

            indexer.bulkUpsert.mockRejectedValue(new Error('DB Error'));

            await expect(ingestService.processBatch(payload)).rejects.toThrow('DB Error');
            expect(metrics.recordWorkerBatch).toHaveBeenCalledWith('error', expect.any(Number), 0);
        });

        it('should process mixed batch with valid and invalid messages', async () => {
            const validDoc = {
                PostID: '1',
                Title: 'Title',
                Body: 'Body',
                CreatedAt: '2023-01-01'
            };
            const invalidDoc = { PostID: '2' };

            const payload = createMockPayload([
                { key: '1', value: validDoc },
                { key: '2', value: invalidDoc }
            ]);

            await ingestService.processBatch(payload);

            expect(indexer.bulkUpsert).toHaveBeenCalledWith(expect.arrayContaining([
                expect.objectContaining({ postId: '1' })
            ]));
            expect(dlqProducer.publish).toHaveBeenCalled();
        });

        it('should handle malformed JSON', async () => {
            const payload = {
                batch: {
                    topic: 'posts',
                    partition: 0,
                    highWatermark: '100',
                    messages: [{
                        key: Buffer.from('123'),
                        value: Buffer.from('not valid json'),
                        timestamp: Date.now().toString(),
                        attributes: 0,
                        offset: '0',
                        headers: {}
                    }],
                    isEmpty: () => false,
                    firstOffset: () => '0',
                    lastOffset: () => '1',
                    offsetLag: () => '0',
                    offsetLagLow: () => '0'
                },
                resolveOffset: vi.fn(),
                heartbeat: vi.fn(),
                commitOffsetsIfNecessary: vi.fn(),
                uncommittedOffsets: vi.fn(),
                isRunning: () => true,
                isStale: () => false,
                pause: vi.fn(),
            } as unknown as EachBatchPayload;

            await ingestService.processBatch(payload);

            expect(dlqProducer.publish).toHaveBeenCalled();
            expect(logger.error).toHaveBeenCalledWith('Message Processing Error - Sending to DLQ', expect.any(Object));
        });

        it('should handle bulk delete failure', async () => {
            const payload = createMockPayload([{ key: '123', value: null }]);

            indexer.bulkDelete.mockRejectedValue(new Error('Delete Error'));

            await expect(ingestService.processBatch(payload)).rejects.toThrow('Delete Error');
            expect(metrics.recordWorkerBatch).toHaveBeenCalledWith('error', expect.any(Number), 0);
        });

        it('should log successful batch processing', async () => {
            const validDoc = {
                PostID: '123',
                Title: 'Title',
                Body: 'Body',
                CreatedAt: '2023-01-01'
            };

            const payload = createMockPayload([{ value: validDoc }]);

            await ingestService.processBatch(payload);

            expect(logger.info).toHaveBeenCalledWith('Batch Processed', expect.objectContaining({
                upserted: 1,
                deleted: 0,
                partition: 0
            }));
        });

        it('accepts camelCase payloads via passthrough', async () => {
            const validDoc = {
                postId: '123',
                title: 'Title',
                body: 'Body',
                createdAt: '2023-01-01',
                imageUrl: 'http://x.test/a.jpg',
            };

            const payload = createMockPayload([{ value: validDoc }]);

            await ingestService.processBatch(payload);

            expect(indexer.bulkUpsert).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ postId: '123', imageUrl: 'http://x.test/a.jpg' }),
                ])
            );
        });

        it('routes unknown shapes to DLQ and increments unknown_shape metric', async () => {
            const payload = createMockPayload([{ key: 'k1', value: { foo: 'bar' } }]);

            await ingestService.processBatch(payload);

            expect(metrics.incrementUnknownShapeCount).toHaveBeenCalledWith('posts');
            expect(dlqProducer.publish).toHaveBeenCalledWith(
                expect.objectContaining({ key: 'k1', error: expect.stringContaining('Unknown event shape') })
            );
            expect(indexer.bulkUpsert).not.toHaveBeenCalled();
        });

        it('normalizes imageUrl: empty string and non-string values become null', async () => {
            const payload = createMockPayload([
                {
                    value: {
                        PostID: '1',
                        Title: 'T',
                        Body: 'B',
                        CreatedAt: '2023-01-01',
                        ImageURL: '   ',
                    },
                },
                {
                    value: {
                        PostID: '2',
                        Title: 'T',
                        Body: 'B',
                        CreatedAt: '2023-01-01',
                        ImageURL: 42,
                    },
                },
            ]);

            await ingestService.processBatch(payload);

            expect(indexer.bulkUpsert).toHaveBeenCalledWith([
                expect.objectContaining({ postId: '1', imageUrl: null }),
                expect.objectContaining({ postId: '2', imageUrl: null }),
            ]);
        });

        it('routes BulkPartialFailureError ids to DLQ and still advances offset', async () => {
            const validDoc = {
                PostID: '1',
                Title: 'T',
                Body: 'B',
                CreatedAt: '2023-01-01',
            };
            const payload = createMockPayload([{ value: validDoc }]);
            indexer.bulkUpsert.mockRejectedValue(
                new BulkPartialFailureError('partial', {
                    operation: 'bulk_upsert',
                    failedIds: [
                        { id: '1', status: 400, reason: 'mapping conflict' },
                    ],
                })
            );

            await ingestService.processBatch(payload);

            expect(dlqProducer.publish).toHaveBeenCalledWith(
                expect.objectContaining({
                    key: '1',
                    error: 'mapping conflict',
                })
            );
            expect(metrics.incrementDlqCount).toHaveBeenCalledWith('posts');
            expect(payload.resolveOffset).toHaveBeenCalled();
        });

        it('does not advance offset when indexer throws a non-partial error', async () => {
            const validDoc = {
                PostID: '1',
                Title: 'T',
                Body: 'B',
                CreatedAt: '2023-01-01',
            };
            const payload = createMockPayload([{ value: validDoc }]);
            indexer.bulkUpsert.mockRejectedValue(new Error('connection lost'));

            await expect(ingestService.processBatch(payload)).rejects.toThrow('connection lost');
            expect(payload.resolveOffset).not.toHaveBeenCalled();
        });
    });
});
