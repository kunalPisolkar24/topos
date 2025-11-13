import express, { Request, Response } from 'express';
import { Kafka, EachMessagePayload } from 'kafkajs';
import pino from 'pino';
import { syncPostToIndex, deletePostFromIndex, PostDocument } from './elasticsearch-helper.js';
import { KAFKA_BROKER, POSTS_TOPIC, ELASTICSEARCH_URL, PORT } from './config.js';

const logger = pino({ level: 'info' });
let isConsumerReady = false;

const kafka = new Kafka({
    clientId: 'elasticsearch-worker',
    brokers: [KAFKA_BROKER]
});

const consumer = kafka.consumer({ groupId: 'elasticsearch-workers-group' });

const runConsumer = async (): Promise<void> => {
    await consumer.connect();
    await consumer.subscribe({ topic: POSTS_TOPIC, fromBeginning: true });
    isConsumerReady = true;
    logger.info({ topic: POSTS_TOPIC }, "Elasticsearch worker connected to Kafka and subscribed.");

    await consumer.run({
        eachMessage: async ({ message }: EachMessagePayload): Promise<void> => {
            if (!message.key) {
                logger.warn("Received message with no key, skipping.");
                return;
            }

            let postId: number | null = null;
            try {
                const postIdStr = message.key.toString();
                postId = parseInt(JSON.parse(postIdStr), 10);
                if (isNaN(postId)) {
                    logger.error({ key: postIdStr }, "Failed to parse postId from message key.");
                    return;
                }

                if (message.value) {
                    const postData: PostDocument = JSON.parse(message.value.toString());
                    logger.info({ postId }, "Received sync event for Elasticsearch.");
                    await syncPostToIndex(ELASTICSEARCH_URL, postData, logger);
                } else {
                    logger.info({ postId }, "Received delete event for Elasticsearch.");
                    await deletePostFromIndex(ELASTICSEARCH_URL, postId, logger);
                }
            } catch (err: any) {
                logger.error({ postId, error: { message: err.message, stack: err.stack } }, "Error processing message for Elasticsearch sync.");
            }
        },
    });
};

const app = express();
app.get('/health', (req: Request, res: Response) => {
    const healthStatus = {
        status: isConsumerReady ? 'OK' : 'UNAVAILABLE',
        message: isConsumerReady ? 'Worker is running and consumer is connected.' : 'Worker is not connected to Kafka yet.'
    };

    if (isConsumerReady) {
        logger.info("Health check requested: status OK.");
    } else {
        logger.warn("Health check requested: status UNAVAILABLE.");
    }

    res.status(isConsumerReady ? 200 : 503).json(healthStatus);
});

app.listen(PORT, () => {
    logger.info({ port: PORT }, `Health check server listening on port.`);
});

runConsumer().catch(e => {
    logger.fatal({ error: { message: e.message, stack: e.stack } }, "[elasticsearch-worker] FATAL ERROR during consumer execution.");
    isConsumerReady = false;
    process.exit(1);
});

const signalTraps: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
signalTraps.forEach(type => {
    process.once(type, async () => {
        logger.info({ signal: type }, `Received signal. Disconnecting consumer...`);
        try {
            await consumer.disconnect();
            logger.info({ signal: type }, `Consumer disconnected gracefully.`);
        } catch (err: any) {
            logger.error({ signal: type, error: { message: err.message } }, `Error during consumer disconnection.`);
        } finally {
            process.kill(process.pid, type);
        }
    });
});