import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';
import { Kafka, Producer } from 'kafkajs';
import { ILogger } from '../../../core/interfaces/logger.interface.js';
import { DlqMessage } from '../../../core/entities/dlq-message.entity.js';
import type { KafkaConfig } from '../kafka.consumer.js';
import { KafkaDlqProducer } from '../dlq.producer.js';

const sendMock = vi.fn();
const connectMock = vi.fn();
const disconnectMock = vi.fn();

const producerInstance: Pick<Producer, 'connect' | 'disconnect' | 'send'> = {
    connect: connectMock,
    disconnect: disconnectMock,
    send: sendMock,
};

const kafkaMock = {
    producer: vi.fn().mockReturnValue(producerInstance),
};

const kafkaConfig: KafkaConfig = {
    brokers: ['localhost:9092'],
    clientId: 'search-service',
    groupId: 'test-group',
    topicPosts: 'posts',
    topicDlq: 'posts.dlq',
    fromBeginning: false,
    partitionsConcurrent: 3,
    sessionTimeoutMs: 30000,
    heartbeatIntervalMs: 3000,
};

describe('KafkaDlqProducer', () => {
    let producer: KafkaDlqProducer;
    let logger: MockProxy<ILogger>;

    beforeEach(() => {
        vi.clearAllMocks();
        logger = mock<ILogger>();
        producer = new KafkaDlqProducer(kafkaMock as unknown as Kafka, kafkaConfig, logger);
    });

    describe('connect', () => {
        it('should connect to kafka', async () => {
            await producer.connect();
            expect(connectMock).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith('DLQ Producer connected');
        });
    });

    describe('disconnect', () => {
        it('should disconnect from kafka', async () => {
            await producer.disconnect();
            expect(disconnectMock).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith('DLQ Producer disconnected');
        });
    });

    describe('publish', () => {
        const message: DlqMessage = {
            originalTopic: 'posts',
            failedAt: '2024-01-01T00:00:00.000Z',
            error: 'validation failed',
            key: 'post-1',
            payload: { foo: 'bar' },
        };

        it('sends the message to the configured DLQ topic', async () => {
            await producer.publish(message);

            expect(sendMock).toHaveBeenCalledWith({
                topic: kafkaConfig.topicDlq,
                messages: [
                    {
                        key: 'post-1',
                        value: JSON.stringify(message),
                    },
                ],
            });
            expect(logger.warn).toHaveBeenCalledWith(
                'Message sent to DLQ',
                expect.objectContaining({ key: 'post-1', error: 'validation failed' })
            );
        });

        it('falls back to "unknown" when no key is provided', async () => {
            const noKey: DlqMessage = { ...message, key: undefined };
            await producer.publish(noKey);

            expect(sendMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    messages: [expect.objectContaining({ key: 'unknown' })],
                })
            );
        });

        it('logs and rethrows on producer send failure', async () => {
            sendMock.mockRejectedValue(new Error('broker down'));
            await expect(producer.publish(message)).rejects.toThrow('broker down');
            expect(logger.error).toHaveBeenCalledWith(
                'Failed to send message to DLQ',
                expect.objectContaining({ error: 'broker down', key: 'post-1' })
            );
        });

        it('retries on transient send errors and eventually succeeds', async () => {
            sendMock.mockRejectedValueOnce(new Error('transient')).mockResolvedValueOnce(undefined);

            await producer.publish(message);

            expect(sendMock).toHaveBeenCalledTimes(2);
        });
    });

    describe('shutdown', () => {
        it('aborts in-flight retries and swallows disconnect errors', async () => {
            disconnectMock.mockRejectedValueOnce(new Error('already disconnected'));

            await producer.disconnect();

            expect(disconnectMock).toHaveBeenCalled();
            expect(logger.error).toHaveBeenCalledWith(
                'DLQ Producer disconnect error',
                expect.objectContaining({ error: 'already disconnected' })
            );
        });
    });
});
