import express, { Request, Response } from 'express';
import { Kafka, EachMessagePayload } from 'kafkajs';
import { syncPostToIndex, deletePostFromIndex, PostDocument } from './elasticsearch-helper.js';
import { KAFKA_BROKER, POSTS_TOPIC, ELASTICSEARCH_URL, PORT } from './config.js';

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
    console.log("Elasticsearch worker connected to Kafka and subscribed to topic:", POSTS_TOPIC);

    await consumer.run({
        eachMessage: async ({ topic, partition, message }: EachMessagePayload): Promise<void> => {
            if (!message.key) {
                console.warn("Received message with no key, skipping.");
                return;
            }
            const postId = parseInt(message.key.toString(), 10);

            try {
                if (message.value) {
                    const postData: PostDocument = JSON.parse(message.value.toString());
                    console.log(`Received sync event for postId: ${postId}`);
                    await syncPostToIndex(ELASTICSEARCH_URL, postData);
                } else {
                    console.log(`Received delete event for postId: ${postId}`);
                    await deletePostFromIndex(ELASTICSEARCH_URL, postId);
                }
            } catch (err) {
                console.error(`Error processing message for postId ${postId}:`, err);
            }
        },
    });
};

const app = express();

app.get('/health', (req: Request, res: Response) => {
    if (isConsumerReady) {
        res.status(200).json({ status: 'OK', message: 'Worker is running and consumer is connected.' });
    } else {
        res.status(503).json({ status: 'UNAVAILABLE', message: 'Worker is starting, consumer not yet ready.' });
    }
});

app.listen(PORT, () => {
    console.log(`Health check server listening on port ${PORT}`);
});

// --- Start the consumer ---
runConsumer().catch(e => {
    console.error('[elasticsearch-worker] FATAL ERROR:', e);
    isConsumerReady = false;
    process.exit(1);
});

// --- Graceful Shutdown ---
const errorTypes: string[] = ['unhandledRejection', 'uncaughtException'];
const signalTraps: string[] = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

errorTypes.forEach(type => {
    process.on(type, async (e: Error) => {
        try {
            console.log(`process.on ${type}`);
            console.error(e);
            await consumer.disconnect();
            process.exit(0);
        } catch (_) {
            process.exit(1);
        }
    });
});

signalTraps.forEach(type => {
    process.once(type, async () => {
        try {
            console.log(`Received ${type} signal. Disconnecting consumer...`);
            await consumer.disconnect();
            console.log('Consumer disconnected gracefully.');
        } finally {
            process.kill(process.pid, type);
        }
    });
});