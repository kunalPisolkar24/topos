import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('8002').transform((val) => parseInt(val, 10)),
  KAFKA_BROKER: z.string().min(1),
  KAFKA_CLIENT_ID: z.string().default('elasticsearch-worker'),
  KAFKA_GROUP_ID: z.string().default('elasticsearch-workers-group'),
  TOPIC_POSTS: z.string().default('posts'),
  TOPIC_DLQ: z.string().default('posts.dlq'),
  ELASTICSEARCH_URL: z.string().url(),
  ELASTICSEARCH_INDEX: z.string().default('posts'),
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 4));
  process.exit(1);
}

export const config = parsed.data;