import { describe, it, expect, vi, afterEach } from 'vitest';
import client from 'prom-client';
import {
  RateLimiter,
  clientIpFromHeaders,
  limitsFromEnv,
  type EvalClient,
  type RateLimitLimits,
} from '../rateLimit.js';
import { Metrics } from '../../observability/metrics.js';

const mocks = vi.hoisted(() => ({
  env: {
    NODE_ENV: 'test',
    LOG_LEVEL: 'info',
    RATELIMIT_ENABLED: true,
    RATELIMIT_SIGNUP_PER_MIN: 5,
    RATELIMIT_SIGNIN_PER_MIN: 10,
    RATELIMIT_MUTATIONS_PER_MIN: 30,
    RATELIMIT_READS_PER_MIN: 120,
    RATELIMIT_WINDOW_SECONDS: 60,
    RATELIMIT_DEGRADED_MULTIPLIER: 2,
    RATELIMIT_AUTH_DEGRADED_MULTIPLIER: 1,
    RATELIMIT_AUTH_CONCURRENCY: 5,
    RATELIMIT_REDIS_TIMEOUT_MS: 150,
    RATELIMIT_MEMORY_MAX_ENTRIES: 10000,
  },
}));

vi.mock('../../config/env.js', () => ({ env: mocks.env }));

function testLimits(overrides: Partial<RateLimitLimits> = {}): RateLimitLimits {
  return {
    enabled: true,
    signupPerMin: 5,
    signinPerMin: 10,
    mutationsPerMin: 2,
    readsPerMin: 2,
    windowMs: 60_000,
    degradedMultiplier: 2,
    authDegradedMultiplier: 1,
    authConcurrency: 5,
    redisTimeoutMs: 200,
    memoryMaxEntries: 10_000,
    ...overrides,
  };
}

// In-memory fake of the Lua script: counts per key, reports the window.
function fakeRedis(windowMs = 60_000): { client: EvalClient; counts: Map<string, number> } {
  const counts = new Map<string, number>();
  const client: EvalClient = {
    eval: vi.fn(async (_script: string, _n: number, key: string, _limit: number, _window: number) => {
      const count = (counts.get(String(key)) ?? 0) + 1;
      counts.set(String(key), count);
      return [count, windowMs];
    }),
  };
  return { client, counts };
}

function failingRedis(): EvalClient {
  return { eval: vi.fn(async () => { throw new Error('redis down'); }) };
}

describe('RateLimiter memory fallback', () => {
  it('allows under quota and rejects over quota with a retry delay', async () => {
    const limiter = new RateLimiter(null, testLimits());

    expect(await limiter.check('reads', 'u:a')).toMatchObject({ allowed: true, degraded: true });
    expect(await limiter.check('reads', 'u:a')).toMatchObject({ allowed: true });
    expect(await limiter.check('reads', 'u:a')).toMatchObject({ allowed: true });
    expect(await limiter.check('reads', 'u:a')).toMatchObject({ allowed: true });
    // Base reads is 2 with a 2x degraded multiplier: memory allows 4.
    const rejected = await limiter.check('reads', 'u:a');
    expect(rejected.allowed).toBe(false);
    expect(rejected.degraded).toBe(true);
    expect(rejected.retryAfterMs).toBeGreaterThan(0);
  });

  it('keeps subjects and policies independent', async () => {
    const limiter = new RateLimiter(null, testLimits());

    for (let i = 0; i < 4; i++) {
      await limiter.check('reads', 'u:a');
    }
    expect((await limiter.check('reads', 'u:a')).allowed).toBe(false);
    expect((await limiter.check('reads', 'u:b')).allowed).toBe(true);
    expect((await limiter.check('mutations', 'u:a')).allowed).toBe(true);
  });

  it('resets the bucket after the window expires', async () => {
    const limiter = new RateLimiter(null, testLimits({ windowMs: 60, degradedMultiplier: 1 }));
    // reads base 2 x 1 = 2 per 60ms window.
    await limiter.check('reads', 'u:a');
    await limiter.check('reads', 'u:a');
    expect((await limiter.check('reads', 'u:a')).allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 80));
    expect((await limiter.check('reads', 'u:a')).allowed).toBe(true);
  });

  it('keeps auth quotas strict in fallback with no headroom', async () => {
    const limiter = new RateLimiter(null, testLimits());
    // signup base 5 x auth multiplier 1 = 5.
    for (let i = 0; i < 5; i++) {
      expect((await limiter.check('signup', 'ip:1.2.3.4')).allowed).toBe(true);
    }
    expect((await limiter.check('signup', 'ip:1.2.3.4')).allowed).toBe(false);
  });

  it('fails open instead of growing unbounded', async () => {
    const limiter = new RateLimiter(null, testLimits({ memoryMaxEntries: 4 }));
    for (let i = 0; i < 10; i++) {
      const decision = await limiter.check('reads', `u:subject-${i}`);
      expect(decision.allowed).toBe(true);
    }
  });
});

describe('RateLimiter redis path', () => {
  it('allows under quota and rejects over quota without degrading', async () => {
    const { client } = fakeRedis();
    const limiter = new RateLimiter(client, testLimits());

    expect(await limiter.check('reads', 'u:a')).toMatchObject({ allowed: true, degraded: false });
    expect(await limiter.check('reads', 'u:a')).toMatchObject({ allowed: true });
    const rejected = await limiter.check('reads', 'u:a');
    expect(rejected).toMatchObject({ allowed: false, degraded: false });
    expect(rejected.retryAfterMs).toBeGreaterThan(0);
    expect(limiter.degraded).toBe(false);
  });

  it('shares one quota across limiter instances on the same redis', async () => {
    const { client } = fakeRedis();
    const first = new RateLimiter(client, testLimits());
    const second = new RateLimiter(client, testLimits());

    expect((await first.check('signin', 'ip:9.9.9.9')).allowed).toBe(true);
    // signin base is 10: exhaust the remaining 9 across both instances.
    for (let i = 0; i < 9; i++) {
      await (i % 2 === 0 ? first : second).check('signin', 'ip:9.9.9.9');
    }
    expect((await second.check('signin', 'ip:9.9.9.9')).allowed).toBe(false);
  });

  it('falls back to memory after repeated redis failures and recovers', async () => {
    const limiter = new RateLimiter(failingRedis(), testLimits());

    for (let i = 0; i < 3; i++) {
      const decision = await limiter.check('reads', 'u:a');
      expect(decision).toMatchObject({ allowed: true, degraded: true });
    }
    expect(limiter.degraded).toBe(true);

    // A fresh client closes the breaker: redis is authoritative again.
    const { client } = fakeRedis();
    limiter.setClient(client);
    expect(limiter.degraded).toBe(false);
    expect(await limiter.check('reads', 'u:a')).toMatchObject({ allowed: true, degraded: false });
  });
});

describe('RateLimiter auth guard', () => {
  it('holds a concurrency slot for the call and releases it', async () => {
    const limiter = new RateLimiter(null, testLimits({ authConcurrency: 1 }));

    const first = await limiter.guardAuth('signin', 'ip:1.1.1.1');
    expect(first.decision.allowed).toBe(true);
    expect(first.release).not.toBeNull();

    const second = await limiter.guardAuth('signin', 'ip:2.2.2.2');
    expect(second.decision.allowed).toBe(false);
    expect(second.release).toBeNull();

    first.release?.();
    const third = await limiter.guardAuth('signin', 'ip:2.2.2.2');
    expect(third.decision.allowed).toBe(true);
    third.release?.();
  });

  it('releases the slot when the quota is exhausted', async () => {
    const limiter = new RateLimiter(null, testLimits({ signupPerMin: 1, authConcurrency: 1 }));

    const first = await limiter.guardAuth('signup', 'ip:3.3.3.3');
    expect(first.decision.allowed).toBe(true);
    first.release?.();

    // Quota is 1x1 in fallback: the next attempt rejects and must not
    // leak the slot it briefly held.
    const second = await limiter.guardAuth('signup', 'ip:3.3.3.3');
    expect(second.decision.allowed).toBe(false);

    const third = await limiter.guardAuth('signup', 'ip:4.4.4.4');
    expect(third.decision.allowed).toBe(true);
    third.release?.();
  });

  it('is a no-op when disabled', async () => {
    const limiter = new RateLimiter(null, testLimits({ enabled: false }));
    expect(limiter.degraded).toBe(false);

    const { decision, release } = await limiter.guardAuth('signup', 'ip:5.5.5.5');
    expect(decision.allowed).toBe(true);
    expect(() => release?.()).not.toThrow();
  });
});

describe('RateLimiter keys and subjects', () => {
  it('namespaces keys away from cache keys', () => {
    expect(RateLimiter.keyFor('reads', 'u:abc')).toBe('rl:user:reads:u:abc');
    expect(RateLimiter.keyFor('signup', 'ip:1.2.3.4')).toBe('rl:user:signup:ip:1.2.3.4');
    expect(RateLimiter.keyFor('reads', '')).toBe('rl:user:reads:ip:unknown');
  });

  it('prefers the user id and falls back to ip', () => {
    expect(RateLimiter.subjectFor('u1', '9.9.9.9')).toBe('u:u1');
    expect(RateLimiter.subjectFor(null, '9.9.9.9')).toBe('ip:9.9.9.9');
  });

  it('records decisions with policy, decision and mode labels', async () => {
    const metrics = new Metrics();
    const limiter = new RateLimiter(null, testLimits({ readsPerMin: 1, degradedMultiplier: 1 }), metrics);

    await limiter.check('reads', 'u:metrics');
    await limiter.check('reads', 'u:metrics');

    const output = await metrics.getMetrics();
    expect(output).toContain('ratelimit_decisions_total{policy="reads",decision="allowed",mode="memory"} 1');
    expect(output).toContain('ratelimit_decisions_total{policy="reads",decision="rejected",mode="memory"} 1');
    client.register.clear();
  });

  it('resolves limits from env', () => {
    expect(limitsFromEnv()).toMatchObject({
      enabled: true,
      signupPerMin: 5,
      signinPerMin: 10,
      windowMs: 60_000,
    });
  });
});

describe('clientIpFromHeaders', () => {
  const headersOf = (values: Record<string, string>) => ({
    get: (name: string): string | null => values[name.toLowerCase()] ?? null,
  });

  it('prefers the first forwarded entry', () => {
    expect(clientIpFromHeaders(headersOf({ 'x-forwarded-for': '203.0.113.7, 70.0.0.1' }))).toBe(
      '203.0.113.7',
    );
  });

  it('falls back to x-real-ip then the socket address', () => {
    expect(clientIpFromHeaders(headersOf({ 'x-real-ip': '198.51.100.9' }))).toBe('198.51.100.9');
    expect(clientIpFromHeaders(headersOf({}), '10.0.0.9:4001')).toBe('10.0.0.9');
  });

  it('collapses spoofed values to unknown', () => {
    expect(clientIpFromHeaders(headersOf({ 'x-forwarded-for': 'not-an-ip' }), 'garbage')).toBe(
      'unknown',
    );
    expect(clientIpFromHeaders(headersOf({}))).toBe('unknown');
  });

  afterEach(() => {
    client.register.clear();
  });
});
