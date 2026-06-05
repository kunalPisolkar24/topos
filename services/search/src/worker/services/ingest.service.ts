import { EachBatchPayload } from 'kafkajs';
import { ISearchIndexer } from '../../core/interfaces/repository.interface.js';
import { IDlqProducer } from '../../core/interfaces/message-broker.interface.js';
import { ILogger } from '../../core/interfaces/logger.interface.js';
import { IMetricsService } from '../../core/interfaces/metrics.interface.js';
import { PostDocument } from '../../core/entities/post.entity.js';
import { BulkPartialFailureError } from '../../core/errors/app.error.js';
import { PostEventSchema, isPascalShape, toPostDocument } from '../../core/entities/post-event.schema.js';

const MAX_BULK_FAILURES_PER_BATCH = 100;

export class IngestService {
    constructor(
        private readonly indexer: ISearchIndexer,
        private readonly dlqProducer: IDlqProducer,
        private readonly logger: ILogger,
        private readonly metrics: IMetricsService
    ) {}

    async processBatch(payload: EachBatchPayload): Promise<void> {
        const { batch, resolveOffset, heartbeat, commitOffsetsIfNecessary } = payload;
        const start = performance.now();

        const docsToUpsert: PostDocument[] = [];
        const idsToDelete: string[] = [];
        let lastSuccessfulOffset: string | null = null;

        for (const message of batch.messages) {
            const messageOffset = message.offset;
            const key = message.key?.toString();

            if (!message.value) {
                if (key) idsToDelete.push(key);
                lastSuccessfulOffset = messageOffset;
                continue;
            }

            const handled = await this.handleMessage(batch.topic, message.value.toString(), key);
            if (handled) {
                docsToUpsert.push(handled);
                lastSuccessfulOffset = messageOffset;
            }
        }

        try {
            if (docsToUpsert.length > 0) {
                try {
                    await this.indexer.bulkUpsert(docsToUpsert);
                } catch (err) {
                    if (err instanceof BulkPartialFailureError) {
                        await this.handlePartialBulkFailure(batch.topic, err.meta.failedIds);
                    } else {
                        throw err;
                    }
                }
            }
            if (idsToDelete.length > 0) {
                try {
                    await this.indexer.bulkDelete(idsToDelete);
                } catch (err) {
                    if (err instanceof BulkPartialFailureError) {
                        await this.handlePartialBulkFailure(batch.topic, err.meta.failedIds);
                    } else {
                        throw err;
                    }
                }
            }

            if (lastSuccessfulOffset !== null) {
                resolveOffset(lastSuccessfulOffset);
            }
            await commitOffsetsIfNecessary();
            await heartbeat();

            const duration = (performance.now() - start) / 1000;
            this.metrics.recordWorkerBatch(
                'success',
                duration,
                docsToUpsert.length + idsToDelete.length
            );

            this.logger.info('Batch Processed', {
                upserted: docsToUpsert.length,
                deleted: idsToDelete.length,
                partition: batch.partition,
            });
        } catch (err: any) {
            const duration = (performance.now() - start) / 1000;
            this.metrics.recordWorkerBatch('error', duration, 0);
            this.logger.error('Batch Processing Fatal Error', { error: err.message });
            throw err;
        }
    }

    private async handleMessage(
        topic: string,
        raw: string,
        key: string | undefined
    ): Promise<PostDocument | null> {
        let eventData: unknown;
        try {
            eventData = JSON.parse(raw);
        } catch (err: any) {
            await this.sendToDlq(topic, `Invalid JSON: ${err.message}`, key, raw);
            return null;
        }

        const parsed = PostEventSchema.safeParse(eventData);
        if (!parsed.success) {
            if (!isPascalShape(eventData)) {
                this.metrics.incrementUnknownShapeCount(topic);
                await this.sendToDlq(
                    topic,
                    `Unknown event shape: ${parsed.error.message}`,
                    key,
                    raw
                );
            } else {
                await this.sendToDlq(topic, `Validation failed: ${parsed.error.message}`, key, raw);
            }
            return null;
        }

        return toPostDocument(parsed.data);
    }

    private async handlePartialBulkFailure(
        topic: string,
        failures: Array<{ id: string; reason?: string; status?: number }>
    ): Promise<void> {
        const bounded = failures.slice(0, MAX_BULK_FAILURES_PER_BATCH);
        this.logger.error('Bulk partial failure - routing to DLQ', {
            count: failures.length,
            sample: bounded.slice(0, 5),
        });

        for (const failure of bounded) {
            this.metrics.incrementDlqCount(topic);
            await this.dlqProducer.publish({
                originalTopic: topic,
                failedAt: new Date().toISOString(),
                error: failure.reason ?? `bulk failure status=${failure.status ?? 'unknown'}`,
                key: failure.id,
                payload: null,
            });
        }
    }

    private async sendToDlq(
        topic: string,
        error: string,
        key: string | undefined,
        payload: string | null
    ): Promise<void> {
        this.logger.error('Message Processing Error - Sending to DLQ', { error });
        this.metrics.incrementDlqCount(topic);
        await this.dlqProducer.publish({
            originalTopic: topic,
            failedAt: new Date().toISOString(),
            error,
            key,
            payload,
        });
    }
}
