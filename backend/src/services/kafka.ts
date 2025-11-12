export type HonoEnv = {
  Bindings: {
    DATABASE_URL: string;
    JWT_SECRET: string;
    DATABASE_URL_MIGRATE: string;
    UPSTASH_REDIS_REST_URL: string;
    UPSTASH_REDIS_REST_TOKEN: string;
    RAILWAY_CONSUMER_WAKEUP_URL: string;
    RAILWAY_WAKEUP_SECRET: string;
    UPSTASH_RATELIMIT_REDIS_REST_URL: string;
    UPSTASH_RATELIMIT_REDIS_REST_TOKEN: string;
    ELASTICSEARCH_URL: string;
    KAFKA_REST_PROXY_URL: string;
  };
};

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
  } catch (error) {
    console.error('Error producing message to Kafka:', error);
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

    await produceMessage(env, POSTS_TOPIC, message);
}