import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';
import { Kafka, Consumer, EachBatchPayload } from 'kafkajs';
import { ILogger } from '../../../core/interfaces/logger.interface.js';

const consumerMock = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    subscribe: vi.fn(),
    run: vi.fn()
};

const kafkaMock = {
    consumer: vi.fn().mockReturnValue(consumerMock)
};

vi.mock('../../../config/index.js', () => ({
    config: {
        KAFKA_GROUP_ID: 'test-group',
        TOPIC_POSTS: 'posts'
    }
}));

import { KafkaConsumer } from '../kafka.consumer.js';

describe('KafkaConsumer', () => {
    let kafkaConsumer: KafkaConsumer;
    let logger: MockProxy<ILogger>;

    beforeEach(() => {
        logger = mock<ILogger>();
        kafkaConsumer = new KafkaConsumer(kafkaMock as unknown as Kafka, logger);
        vi.clearAllMocks();
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
                fromBeginning: true
            });
            expect(consumerMock.run).toHaveBeenCalledWith(expect.objectContaining({
                autoCommit: false,
                eachBatchAutoResolve: false,
                partitionsConsumedConcurrently: 3
            }));
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
            expect(logger.error).toHaveBeenCalledWith('Fatal Batch Error', { error: 'Handler Error' });
        });
    });
});
