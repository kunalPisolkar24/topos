import { Redis } from 'ioredis';
import { env } from '../config/env.js';

const PING_TIMEOUT_MS = 2000;

function retryStrategy(times: number): number {
  const base = Math.min(times * 200, 3000);
  return base + Math.random() * base * 0.2;
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
    const client = new Redis(env.REDIS_URL, baseOptions());
    client.on('error', () => {
      // Prevent unhandled error crashes; fail-open via CacheManager and metrics gauge.
    });
    return client;
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
