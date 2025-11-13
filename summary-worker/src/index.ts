import express, { Request, Response } from 'express';
import { Kafka, EachMessagePayload } from 'kafkajs';
import fetch from 'node-fetch';
import pino from 'pino';
import { callSummarizeService } from './services/mlService.js';
import { KAFKA_BROKER, POSTS_TOPIC, PORT, API_CALLBACK_URL, API_CALLBACK_SECRET } from './config.js';

const logger = pino({ level: 'info' });

interface PostEventPayload {
    postId: number;
    body: string;
}

let isConsumerReady = false;

const kafka = new Kafka({
    clientId: 'summary-worker',
    brokers: [KAFKA_BROKER],
});
const consumer = kafka.consumer({ groupId: 'summary-workers-group' });

const runConsumer = async (): Promise<void> => {
    await consumer.connect();
    await consumer.subscribe({ topic: POSTS_TOPIC, fromBeginning: true });
    isConsumerReady = true;
    logger.info({ topic: POSTS_TOPIC }, "Summary worker connected to Kafka and subscribed.");

    await consumer.run({
        eachMessage: async ({ message }: EachMessagePayload): Promise<void> => {
            if (!message.value) {
                logger.warn({ key: message.key?.toString() }, "Ignoring event with no message value.");
                return;
            }

            let postId: number | null = null;
            try {
                const payload: PostEventPayload = JSON.parse(message.value.toString());
                postId = payload.postId;
                logger.info({ postId }, "Received summarization job.");

                const summary = await callSummarizeService(payload.body);

                if (summary) {
                    await updatePostWithSummary(postId, summary);
                } else {
                    logger.error({ postId }, "Summarization failed. The ML service returned no summary. Job will not be retried.");
                }
            } catch (err: any) {
                logger.error({ postId, error: { message: err.message, stack: err.stack } }, "Error processing Kafka message.");
            }
        },
    });
};

async function updatePostWithSummary(postId: number, summary: string): Promise<void> {
    logger.info({ postId }, "Sending summary back to API for processing.");
    try {
        const response = await fetch(`${API_CALLBACK_URL}/api/posts/${postId}/summary`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Secret': API_CALLBACK_SECRET || '',
            },
            body: JSON.stringify({ summary }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API callback failed with status ${response.status}: ${errorBody}`);
        }
        logger.info({ postId }, "Successfully updated summary via API callback.");
    } catch (error: any) {
        logger.error({ postId, error: { message: error.message } }, `Failed to call back API for post summary update.`);
    }
}

const app = express();
app.get('/health', (req: Request, res: Response) => {
    const healthStatus = {
        status: isConsumerReady ? 'OK' : 'UNAVAILABLE',
        message: isConsumerReady ? 'Worker is running and connected to Kafka.' : 'Worker is not connected to Kafka yet.'
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
    logger.fatal({ error: { message: e.message, stack: e.stack } }, "[summary-worker] FATAL ERROR during consumer execution.");
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