import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const runtimeEnv = {
  ...process.env,
  API_PORT: process.env.API_PORT ?? process.env.PORT,
};

const portSchema = z.coerce.number().int().min(1).max(65535);

const sharedConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ELASTICSEARCH_URL: z.string().url(),
  ELASTICSEARCH_INDEX: z.string().default('posts'),
  REDIS_SENTINEL_HOSTS: z.string().min(1),
  REDIS_MASTER_NAME: z.string().default('mymaster'),
});

const apiConfigSchema = sharedConfigSchema.extend({
  API_PORT: portSchema.default(4003),
});

const workerConfigSchema = sharedConfigSchema.extend({
  WORKER_METRICS_PORT: portSchema.default(7091),
  KAFKA_BROKER: z.string().min(1),
  KAFKA_CLIENT_ID: z.string().default('search-service'),
  KAFKA_GROUP_ID: z.string().default('search-workers-group'),
  TOPIC_POSTS: z.string().default('posts'),
  TOPIC_DLQ: z.string().default('posts.dlq'),
});

const readConfig = <TSchema extends z.ZodTypeAny>(schema: TSchema): z.infer<TSchema> => {
  const parsed = schema.safeParse(runtimeEnv);
  if (parsed.success) {
    return parsed.data;
  }
  console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 4));
  process.exit(1);
};

export type SharedConfig = z.infer<typeof sharedConfigSchema>;
export type ApiConfig = z.infer<typeof apiConfigSchema>;
export type WorkerConfig = z.infer<typeof workerConfigSchema>;

let sharedConfigCache: SharedConfig | null = null;
let apiConfigCache: ApiConfig | null = null;
let workerConfigCache: WorkerConfig | null = null;

export const getSharedConfig = (): SharedConfig => {
  if (!sharedConfigCache) {
    sharedConfigCache = readConfig(sharedConfigSchema);
  }
  return sharedConfigCache;
};

export const getApiConfig = (): ApiConfig => {
  if (!apiConfigCache) {
    apiConfigCache = readConfig(apiConfigSchema);
  }
  return apiConfigCache;
};

export const getWorkerConfig = (): WorkerConfig => {
  if (!workerConfigCache) {
    workerConfigCache = readConfig(workerConfigSchema);
  }
  return workerConfigCache;
};
