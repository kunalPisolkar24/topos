import { HonoEnv } from '../routes/posts';
import { logger } from '../logger';

interface KafkaMessage {
  key: string;
  value: any;
}

const POSTS_TOPIC = 'posts';

async function produceMessage(env: HonoEnv['Bindings'], topic: string, message: KafkaMessage): Promise<void> {
  const kafkaUrl = `${env.KAFKA_REST_PROXY_URL}/topics/${topic}`;

  try {
    const response = await fetch(kafkaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.kafka.json.v2+json',
      },
      body: JSON.stringify({ records: [{ key: message.key, value: message.value }] }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to produce message to Kafka. Status: ${response.status}, Body: ${errorBody}`);
    }
  } catch (error: any) {
    logger.error('Error producing message to Kafka.', {
      topic,
      key: message.key,
      error: { message: error.message }
    });
    throw error;
  }
}

export async function producePostEvent(env: HonoEnv['Bindings'], post: any, eventType: 'create' | 'update' | 'delete'): Promise<void> {
  const messageValue = eventType !== 'delete' ? {
    postId: post.id,
    title: post.title,
    body: post.body,
    authorName: post.author?.name || 'Unknown',
    imageUrl: post.imageUrl,
    createdAt: post.createdAt,
  } : null;

  const message: KafkaMessage = {
    key: post.id.toString(),
    value: messageValue,
  };

  logger.info('Producing post event to Kafka.', {
    topic: POSTS_TOPIC,
    eventType,
    postId: post.id
  });

  await produceMessage(env, POSTS_TOPIC, message);
}