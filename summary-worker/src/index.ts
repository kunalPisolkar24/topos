import express, { Request, Response } from 'express';
import { Kafka, EachMessagePayload } from 'kafkajs';
import fetch from 'node-fetch';
import { callSummarizeService } from './services/mlService.js';
import { KAFKA_BROKER, POSTS_TOPIC, PORT, API_CALLBACK_URL } from './config.js';

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
    console.log("Summary worker connected to Kafka, subscribed to:", POSTS_TOPIC);

    await consumer.run({
        eachMessage: async ({ message }: EachMessagePayload): Promise<void> => {
            if (!message.value) {
                console.log(`Ignoring delete event for key: ${message.key}`);
                return;
            }

            try {
                const { postId, body }: PostEventPayload = JSON.parse(message.value.toString());
                console.log(`Received job for postId: ${postId}`);

                const summary = await callSummarizeService(body);

                if (summary) {
                    await updatePostWithSummary(postId, summary);
                } else {
                    console.error(`Summarization failed for postId: ${postId}. Job will not be retried automatically.`);
                }
            } catch (err: any) {
                console.error("Error processing message:", err);
            }
        },
    });
};

async function updatePostWithSummary(postId: number, summary: string): Promise<void> {
    console.log(`Sending summary back to API for postId: ${postId}`);
    try {
        const response = await fetch(`${API_CALLBACK_URL}/api/posts/${postId}/summary`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ summary }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API callback failed with status ${response.status}: ${errorBody}`);
        }
        console.log(`Successfully updated summary for postId: ${postId} via API callback.`);
    } catch (error) {
        console.error(`Failed to call back API for postId ${postId}:`, error);
    }
}

const app = express();
app.get('/health', (req: Request, res: Response) => {
    res.status(isConsumerReady ? 200 : 503).json({
        status: isConsumerReady ? 'OK' : 'UNAVAILABLE',
        message: isConsumerReady ? 'Worker is running.' : 'Worker is not connected to Kafka yet.'
    });
});

app.listen(PORT, () => {
    console.log(`Health check server listening on port ${PORT}`);
});

// runConsumer().catch(e => {
//     console.error('[summary-worker] FATAL ERROR:', e);
//     isConsumerReady = false;
//     process.exit(1);
// });

const signalTraps: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
signalTraps.forEach(type => {
    process.once(type, async () => {
        try {
            console.log(`Received ${type} signal. Disconnecting consumer...`);
            await consumer.disconnect();
        } finally {
            process.kill(process.pid, type);
        }
    });
});