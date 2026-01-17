import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.string().default('4003').transform((val) => parseInt(val, 10)),
  WORKER_METRICS_PORT: z.string().default('7091').transform((val) => parseInt(val, 10)),
  
  KAFKA_BROKER: z.string().min(1),
  KAFKA_CLIENT_ID: z.string().default('search-service'),
  KAFKA_GROUP_ID: z.string().default('search-workers-group'),
  TOPIC_POSTS: z.string().default('posts'),
  TOPIC_DLQ: z.string().default('posts.dlq'),
  
  ELASTICSEARCH_URL: z.string().url(),
  ELASTICSEARCH_INDEX: z.string().default('posts'),
  
  REDIS_SENTINEL_HOSTS: z.string().min(1),
  REDIS_MASTER_NAME: z.string().default('mymaster'),
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 4));
  process.exit(1);
}

export const config = parsed.data;