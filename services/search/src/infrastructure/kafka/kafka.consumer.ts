import { Kafka, Consumer, EachBatchPayload } from 'kafkajs';
import { ILogger } from '../../core/interfaces/logger.interface.js';
import type { IConfig } from '../../core/interfaces/config.interface.js';

export type KafkaConfig = NonNullable<IConfig['kafka']>;

export interface IBatchConsumer {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    startBatch(handler: (payload: EachBatchPayload) => Promise<void>): Promise<void>;
    isHealthy(): Promise<boolean>;
}

export class KafkaConsumer implements IBatchConsumer {
    private readonly consumer: Consumer;
    private connected = false;

    constructor(
        kafka: Kafka,
        private readonly kafkaConfig: KafkaConfig,
        private readonly logger: ILogger
    ) {
        this.consumer = kafka.consumer({
            groupId: this.kafkaConfig.groupId,
            sessionTimeout: this.kafkaConfig.sessionTimeoutMs,
            heartbeatInterval: this.kafkaConfig.heartbeatIntervalMs,
        });
    }

    async connect(): Promise<void> {
        await this.consumer.connect();
        this.connected = true;
        this.logger.info('Kafka Consumer connected');
    }

    async disconnect(): Promise<void> {
        await this.consumer.disconnect();
        this.connected = false;
        this.logger.info('Kafka Consumer disconnected');
    }

    async isHealthy(): Promise<boolean> {
        return this.connected;
    }

    async startBatch(handler: (payload: EachBatchPayload) => Promise<void>): Promise<void> {
        await this.consumer.subscribe({
            topic: this.kafkaConfig.topicPosts,
            fromBeginning: this.kafkaConfig.fromBeginning,
        });

        await this.consumer.run({
            autoCommit: false,
            eachBatchAutoResolve: false,
            partitionsConsumedConcurrently: this.kafkaConfig.partitionsConcurrent,
            eachBatch: async (payload) => {
                try {
                    await handler(payload);
                } catch (error: any) {
                    this.logger.error('Fatal Batch Error', { error: error.message });
                    throw error;
                }
            },
        });
    }
}
