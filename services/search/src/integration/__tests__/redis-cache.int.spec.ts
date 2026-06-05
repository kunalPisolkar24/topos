import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RedisCache } from '../../infrastructure/redis/redis.cache.js';
import { stubLogger } from '../helpers/fixtures.js';
import type { RedisConfig } from '../../infrastructure/redis/redis.cache.js';

let cache: RedisCache;

function getRedisConfig(): RedisConfig {
  const url = process.env.INTEGRATION_REDIS_URL;
  if (!url) throw new Error('INTEGRATION_REDIS_URL not set');
  return {
    url,
    sentinelHosts: undefined,
    sentinelMasterName: 'mymaster',
    password: undefined,
    sentinelPassword: undefined,
    sentinelTls: false,
  };
}

beforeAll(async () => {
  cache = new RedisCache(getRedisConfig(), stubLogger);
  await cache.connect();
});

afterAll(async () => {
  await cache.disconnect();
});

describe('RedisCache integration', () => {
  it('ping succeeds on connected client', async () => {
    await expect(cache.ping()).resolves.toBeUndefined();
  });

  it('set stores a value and get retrieves it', async () => {
    await cache.set('int:key1', 'hello-world');
    const val = await cache.get('int:key1');
    expect(val).toBe('hello-world');
  });

  it('get returns null for a missing key', async () => {
    const val = await cache.get('int:missing-key');
    expect(val).toBeNull();
  });

  it('set with TTL expires the key', async () => {
    await cache.set('int:ttl-key', 'ttl-value', 1);
    const before = await cache.get('int:ttl-key');
    expect(before).toBe('ttl-value');

    await new Promise((r) => setTimeout(r, 1500));

    const after = await cache.get('int:ttl-key');
    expect(after).toBeNull();
  });

  it('delete removes a stored key', async () => {
    await cache.set('int:delete-me', 'value');
    await cache.delete('int:delete-me');
    const val = await cache.get('int:delete-me');
    expect(val).toBeNull();
  });

  it('set without TTL persists indefinitely (no expiry)', async () => {
    await cache.set('int:persist', 'forever');
    await cache.delete('int:persist');
    await expect(cache.get('int:persist')).resolves.toBeNull();
  });
});
