import { Kafka, Producer, Partitioners } from 'kafkajs';
import { IDlqProducer } from '../../core/interfaces/message-broker.interface.js';
import { DlqMessage } from '../../core/entities/dlq-message.entity.js';
import { ILogger } from '../../core/interfaces/logger.interface.js';
import { withRetry } from '../../utils/retry.util.js';
import type { KafkaConfig } from './kafka.consumer.js';

export class KafkaDlqProducer implements IDlqProducer {
    private readonly producer: Producer;
    private readonly retrySignal = new AbortController();

    constructor(
        kafka: Kafka,
        private readonly kafkaConfig: KafkaConfig,
        private readonly logger: ILogger
    ) {
        this.producer = kafka.producer({
            createPartitioner: Partitioners.DefaultPartitioner,
            idempotent: true,
            maxInFlightRequests: 5,
        });
    }

    async connect(): Promise<void> {
        await this.producer.connect();
        this.logger.info('DLQ Producer connected');
    }

    async disconnect(): Promise<void> {
        this.retrySignal.abort();
        try {
            await this.producer.disconnect();
        } catch (err: any) {
            this.logger.error('DLQ Producer disconnect error', { error: err.message });
        }
        this.logger.info('DLQ Producer disconnected');
    }

    async publish(message: DlqMessage): Promise<void> {
        const value = JSON.stringify(message);
        const key = message.key ?? 'unknown';

        try {
            await withRetry(
                () =>
                    this.producer.send({
                        topic: this.kafkaConfig.topicDlq,
                        messages: [{ key, value }],
                    }),
                this.logger,
                {
                    retries: 3,
                    delay: 500,
                    factor: 2,
                    maxDelay: 8000,
                    jitter: 'full',
                    signal: this.retrySignal.signal,
                }
            );
            this.logger.warn('Message sent to DLQ', { key, error: message.error });
        } catch (error: any) {
            this.logger.error('Failed to send message to DLQ', { error: error.message, key });
            throw error;
        }
    }
}
