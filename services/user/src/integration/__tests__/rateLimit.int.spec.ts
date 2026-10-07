import { describe, it, expect, afterEach } from 'vitest';
import { Redis } from 'ioredis';
import { RateLimiter, type RateLimitLimits } from '../../lib/rateLimit.js';

function testLimits(windowMs: number, quota: number): RateLimitLimits {
  return {
    enabled: true,
    signupPerMin: quota,
    signinPerMin: quota,
    mutationsPerMin: quota,
    readsPerMin: quota,
    windowMs,
    degradedMultiplier: 2,
    authDegradedMultiplier: 1,
    authConcurrency: 5,
    redisTimeoutMs: 2000,
    memoryMaxEntries: 10000,
  };
}

const clients: Redis[] = [];

function testClient(url = process.env.REDIS_URL!): Redis {
  const client = new Redis(url, { maxRetriesPerRequest: 1, enableOfflineQueue: false });
  client.on('error', () => {
    // Expected in outage tests; failover is asserted, not the error event.
  });
  clients.push(client);
  return client;
}

async function readyClient(url = process.env.REDIS_URL!): Promise<Redis> {
  const client = testClient(url);
  if (client.status !== 'ready') {
    await new Promise<void>((resolve, reject) => {
      client.once('ready', () => resolve());
      client.once('error', (err: unknown) => reject(err));
    });
  }
  return client;
}

describe('rate limiting against real redis', () => {
  afterEach(async () => {
    while (clients.length > 0) {
      const client = clients.pop()!;
      try {
        await client.flushall();
      } catch {
        // Unreachable clients have nothing to flush.
      }
      client.disconnect();
    }
  });

  it('shares one quota across limiter instances on the same redis', async () => {
    const first = new RateLimiter(await readyClient(), testLimits(60_000, 3));
    const second = new RateLimiter(await readyClient(), testLimits(60_000, 3));

    expect((await first.check('reads', 'u:shared')).allowed).toBe(true);
    expect((await second.check('reads', 'u:shared')).allowed).toBe(true);
    expect((await first.check('reads', 'u:shared')).allowed).toBe(true);
    expect((await second.check('reads', 'u:shared')).allowed).toBe(false);
    expect((await first.check('reads', 'u:other')).allowed).toBe(true);
  });

  it('expires quota keys so they cannot grow unbounded', async () => {
    const client = await readyClient();
    const limiter = new RateLimiter(client, testLimits(2000, 1));

    expect((await limiter.check('reads', 'u:ttl')).allowed).toBe(true);
    expect((await limiter.check('reads', 'u:ttl')).allowed).toBe(false);

    const ttl = await client.pttl('rl:user:reads:u:ttl');
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(2000);

    await new Promise((resolve) => setTimeout(resolve, 2200));
    expect((await limiter.check('reads', 'u:ttl')).allowed).toBe(true);
  });

  it('serves memory fallback while redis is unreachable', async () => {
    const limiter = new RateLimiter(await readyClient(), testLimits(60_000, 2));
    expect((await limiter.check('reads', 'u:flap')).allowed).toBe(true);
    expect(limiter.degraded).toBe(false);

    limiter.setClient(testClient('redis://localhost:1'));
    const decision = await limiter.check('reads', 'u:flap');
    expect(decision.allowed).toBe(true);
    expect(decision.degraded).toBe(true);
  });
});
