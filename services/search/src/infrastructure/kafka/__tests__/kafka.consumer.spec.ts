import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';
import { Kafka, EachBatchPayload } from 'kafkajs';
import { ILogger } from '../../../core/interfaces/logger.interface.js';
import type { KafkaConfig } from '../kafka.consumer.js';

const consumerMock = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    subscribe: vi.fn(),
    run: vi.fn(),
};

const kafkaMock = {
    consumer: vi.fn().mockReturnValue(consumerMock),
};

const kafkaConfig: KafkaConfig = {
    brokers: ['localhost:9092'],
    clientId: 'search-service',
    groupId: 'test-group',
    topicPosts: 'posts',
    topicDlq: 'posts.dlq',
    fromBeginning: true,
    partitionsConcurrent: 3,
    sessionTimeoutMs: 30000,
    heartbeatIntervalMs: 3000,
};

import { KafkaConsumer } from '../kafka.consumer.js';

describe('KafkaConsumer', () => {
    let kafkaConsumer: KafkaConsumer;
    let logger: MockProxy<ILogger>;

    beforeEach(() => {
        vi.clearAllMocks();
        logger = mock<ILogger>();
        kafkaConsumer = new KafkaConsumer(kafkaMock as unknown as Kafka, kafkaConfig, logger);
    });

    describe('connect', () => {
        it('should connect to kafka', async () => {
            await kafkaConsumer.connect();

            expect(consumerMock.connect).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith('Kafka Consumer connected');
        });
    });

    describe('disconnect', () => {
        it('should disconnect from kafka', async () => {
            await kafkaConsumer.disconnect();

            expect(consumerMock.disconnect).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith('Kafka Consumer disconnected');
        });
    });

    describe('startBatch', () => {
        it('should subscribe to topic and start consuming', async () => {
            const handler = vi.fn();

            await kafkaConsumer.startBatch(handler);

            expect(consumerMock.subscribe).toHaveBeenCalledWith({
                topic: 'posts',
                fromBeginning: true,
            });
            expect(consumerMock.run).toHaveBeenCalledWith(
                expect.objectContaining({
                    autoCommit: false,
                    eachBatchAutoResolve: false,
                    partitionsConsumedConcurrently: 3,
                })
            );
        });

        it('should call handler on batch processing', async () => {
            const handler = vi.fn();
            consumerMock.run.mockImplementation(async (config: any) => {
                const mockPayload = { batch: { messages: [] } } as unknown as EachBatchPayload;
                await config.eachBatch(mockPayload);
            });

            await kafkaConsumer.startBatch(handler);

            expect(handler).toHaveBeenCalled();
        });

        it('should log and rethrow error on batch processing failure', async () => {
            const handler = vi.fn().mockRejectedValue(new Error('Handler Error'));
            consumerMock.run.mockImplementation(async (config: any) => {
                const mockPayload = { batch: { messages: [] } } as unknown as EachBatchPayload;
                await config.eachBatch(mockPayload);
            });

            await expect(kafkaConsumer.startBatch(handler)).rejects.toThrow('Handler Error');
            expect(logger.error).toHaveBeenCalledWith('Fatal Batch Error', {
                error: 'Handler Error',
            });
        });
    });

    describe('config injection', () => {
        it('honours fromBeginning=false from config', async () => {
            const handler = vi.fn();
            const cfg: KafkaConfig = { ...kafkaConfig, fromBeginning: false };
            const consumer = new KafkaConsumer(
                kafkaMock as unknown as Kafka,
                cfg,
                logger
            );

            await consumer.startBatch(handler);

            expect(consumerMock.subscribe).toHaveBeenCalledWith({
                topic: 'posts',
                fromBeginning: false,
            });
        });

        it('uses partitionsConcurrent from config', async () => {
            const handler = vi.fn();
            const cfg: KafkaConfig = { ...kafkaConfig, partitionsConcurrent: 7 };
            const consumer = new KafkaConsumer(
                kafkaMock as unknown as Kafka,
                cfg,
                logger
            );

            await consumer.startBatch(handler);

            expect(consumerMock.run).toHaveBeenCalledWith(
                expect.objectContaining({ partitionsConsumedConcurrently: 7 })
            );
        });
    });
});
