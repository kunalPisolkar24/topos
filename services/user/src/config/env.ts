import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  PORT: z.string().default('4001'),
  JWT_SECRET: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  DATABASE_URL_MIGRATE: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
});

export const env = envSchema.parse(process.env);