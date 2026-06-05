import { Kafka, Producer, Partitioners } from 'kafkajs';
import { IDlqProducer } from '../../core/interfaces/message-broker.interface.js';
import { DlqMessage } from '../../core/entities/dlq-message.entity.js';
import { ILogger } from '../../core/interfaces/logger.interface.js';
import type { KafkaConfig } from './kafka.consumer.js';

export class KafkaDlqProducer implements IDlqProducer {
    private readonly producer: Producer;

    constructor(
        kafka: Kafka,
        private readonly kafkaConfig: KafkaConfig,
        private readonly logger: ILogger
    ) {
        this.producer = kafka.producer({
            createPartitioner: Partitioners.LegacyPartitioner,
        });
    }

    async connect(): Promise<void> {
        await this.producer.connect();
        this.logger.info('DLQ Producer connected');
    }

    async disconnect(): Promise<void> {
        await this.producer.disconnect();
        this.logger.info('DLQ Producer disconnected');
    }

    async publish(message: DlqMessage): Promise<void> {
        try {
            await this.producer.send({
                topic: this.kafkaConfig.topicDlq,
                messages: [
                    {
                        key: message.key || 'unknown',
                        value: JSON.stringify(message),
                    },
                ],
            });
            this.logger.warn('Message sent to DLQ', { key: message.key, error: message.error });
        } catch (error: any) {
            this.logger.error('Failed to send message to DLQ', { error: error.message });
            throw error;
        }
    }
}
