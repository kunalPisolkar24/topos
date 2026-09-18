import { Redis } from 'ioredis';
import { env } from '../config/env.js';

const MAX_RECONNECT_ATTEMPTS = 5;
const PING_TIMEOUT_MS = 2000;

function retryStrategy(times: number): number | null {
  if (times > MAX_RECONNECT_ATTEMPTS) {
    return null;
  }
  return Math.min(times * 200, 1000);
}

function baseOptions(): Record<string, unknown> {
  return {
    // Fail fast while disconnected so CacheManager can fall back to the DB
    // (the fail-open design) instead of hanging on queued commands.
    enableOfflineQueue: false,
    maxRetriesPerRequest: 2,
    connectTimeout: 2000,
    retryStrategy,
  };
}

function createClient(): Redis | null {
  if (env.REDIS_URL) {
    return new Redis(env.REDIS_URL, baseOptions());
  }

  return null;
}

export const redis = createClient();

export async function closeRedis(): Promise<void> {
  if (redis) {
    redis.disconnect();
  }
}

export async function pingRedis(client: Redis | null = redis): Promise<'ok' | 'unavailable'> {
  if (!client) {
    return 'unavailable';
  }
  try {
    await Promise.race([
      client.ping(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('redis ping timed out')), PING_TIMEOUT_MS),
      ),
    ]);
    return 'ok';
  } catch {
    return 'unavailable';
  }
}
