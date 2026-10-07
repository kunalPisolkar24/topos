import type { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../observability/logger.js';
import type { Metrics, RateLimitDecision, RateLimitMode } from '../observability/metrics.js';

// One quota bucket per operation class. Signup and signin stay separate
// so a signup burst never eats the signin budget (and vice versa).
export type RateLimitPolicy = 'signup' | 'signin' | 'mutations' | 'reads';

export interface RateLimitDecisionResult {
  allowed: boolean;
  retryAfterMs: number;
  degraded: boolean;
}

export interface RateLimitLimits {
  enabled: boolean;
  signupPerMin: number;
  signinPerMin: number;
  mutationsPerMin: number;
  readsPerMin: number;
  windowMs: number;
  degradedMultiplier: number;
  authDegradedMultiplier: number;
  authConcurrency: number;
  redisTimeoutMs: number;
  memoryMaxEntries: number;
}

export function limitsFromEnv(): RateLimitLimits {
  return {
    enabled: env.RATELIMIT_ENABLED ?? true,
    signupPerMin: env.RATELIMIT_SIGNUP_PER_MIN ?? 5,
    signinPerMin: env.RATELIMIT_SIGNIN_PER_MIN ?? 10,
    mutationsPerMin: env.RATELIMIT_MUTATIONS_PER_MIN ?? 30,
    readsPerMin: env.RATELIMIT_READS_PER_MIN ?? 120,
    windowMs: (env.RATELIMIT_WINDOW_SECONDS ?? 60) * 1000,
    degradedMultiplier: env.RATELIMIT_DEGRADED_MULTIPLIER ?? 2,
    authDegradedMultiplier: env.RATELIMIT_AUTH_DEGRADED_MULTIPLIER ?? 1,
    authConcurrency: env.RATELIMIT_AUTH_CONCURRENCY ?? 5,
    redisTimeoutMs: env.RATELIMIT_REDIS_TIMEOUT_MS ?? 150,
    memoryMaxEntries: env.RATELIMIT_MEMORY_MAX_ENTRIES ?? 10000,
  };
}

// Atomic fixed-window counter: INCR the bucket, arm its TTL on first
// hit, and report the count with the remaining TTL. One script means
// the verdict is correct across replicas sharing the Redis instance.
const ALLOW_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[2])
end
local ttl = redis.call("PTTL", KEYS[1])
return {current, ttl}
`;

// Minimal Redis surface the limiter needs; ioredis satisfies it and
// tests stub it.
export interface EvalClient {
  eval(script: string, numberOfKeys: number, ...args: Array<string | number>): Promise<unknown>;
}

interface MemWindow {
  count: number;
  expiresAt: number;
}

const BREAKER_FAILURE_THRESHOLD = 3;
const BREAKER_RESET_WINDOW_MS = 10_000;

export class RateLimiter {
  private readonly breaker = { state: 0 as 0 | 1 | 2, failures: 0, lastFailureAt: 0 };
  private readonly memory = new Map<string, MemWindow>();
  private authInFlight = 0;

  constructor(
    private redis: Redis | EvalClient | null,
    private readonly limits: RateLimitLimits = limitsFromEnv(),
    private readonly metrics?: Metrics,
  ) {
    if (!redis) {
      this.openBreaker();
    }
  }

  get degraded(): boolean {
    return !this.limits.enabled ? false : this.breaker.state !== 0;
  }

  setClient(redis: Redis | EvalClient | null): void {
    this.redis = redis;
    if (!redis) {
      this.openBreaker();
    } else {
      this.closeBreaker();
    }
  }

  static keyFor(policy: RateLimitPolicy, subject: string): string {
    const clean = subject.trim().slice(0, 128) || 'ip:unknown';
    return `rl:user:${policy}:${clean}`;
  }

  static subjectFor(userId: string | null, clientIp: string): string {
    return userId ? `u:${userId}` : `ip:${clientIp}`;
  }

  private baseLimit(policy: RateLimitPolicy): number {
    switch (policy) {
      case 'signup':
        return this.limits.signupPerMin;
      case 'signin':
        return this.limits.signinPerMin;
      case 'mutations':
        return this.limits.mutationsPerMin;
      default:
        return this.limits.readsPerMin;
    }
  }

  private degradedLimit(policy: RateLimitPolicy): number {
    const base = this.baseLimit(policy);
    // Auth flows keep their quota in fallback (no headroom) so a Redis
    // outage cannot weaken brute-force protection; ordinary traffic
    // gets modest headroom to preserve availability.
    const mult = policy === 'signup' || policy === 'signin'
      ? this.limits.authDegradedMultiplier
      : this.limits.degradedMultiplier;
    return base * Math.max(1, mult);
  }

  async check(policy: RateLimitPolicy, subject: string): Promise<RateLimitDecisionResult> {
    if (!this.limits.enabled || this.baseLimit(policy) <= 0) {
      return { allowed: true, retryAfterMs: 0, degraded: false };
    }
    if (this.canUseRedis()) {
      const viaRedis = await this.checkRedis(policy, subject);
      if (viaRedis) {
        return viaRedis;
      }
    }
    return this.checkMemory(policy, subject);
  }

  // Guards the bcrypt path: quota first, then one concurrency slot for
  // the duration of the auth call. Returns a release function the
  // caller must invoke exactly once when allowed; null on rejection.
  async guardAuth(
    policy: 'signup' | 'signin',
    subject: string,
  ): Promise<{ decision: RateLimitDecisionResult; release: (() => void) | null }> {
    if (!this.limits.enabled) {
      return { decision: { allowed: true, retryAfterMs: 0, degraded: false }, release: () => {} };
    }
    if (this.authInFlight >= this.limits.authConcurrency) {
      this.record(policy, 'rejected', this.degraded);
      logger.info({ policy, degraded: this.degraded }, 'ratelimit: auth concurrency exhausted');
      return { decision: { allowed: false, retryAfterMs: 1000, degraded: this.degraded }, release: null };
    }
    this.authInFlight += 1;
    this.metrics?.authInFlightInc();
    const decision = await this.check(policy, subject);
    if (!decision.allowed) {
      this.releaseAuthSlot();
      return { decision, release: null };
    }
    let released = false;
    return {
      decision,
      release: () => {
        if (!released) {
          released = true;
          this.releaseAuthSlot();
        }
      },
    };
  }

  private releaseAuthSlot(): void {
    this.authInFlight = Math.max(0, this.authInFlight - 1);
    this.metrics?.authInFlightDec();
  }

  private async checkRedis(
    policy: RateLimitPolicy,
    subject: string,
  ): Promise<RateLimitDecisionResult | null> {
    const client = this.redis;
    if (!client) {
      return null;
    }
    const limit = this.baseLimit(policy);
    try {
      const raw = await withTimeout(
        client.eval(ALLOW_SCRIPT, 1, RateLimiter.keyFor(policy, subject), limit, this.limits.windowMs),
        this.limits.redisTimeoutMs,
      );
      this.closeBreaker();
      const [count, ttlMs] = parseEvalResult(raw);
      const allowed = count <= limit;
      const retryAfterMs = allowed ? 0 : Math.max(1, ttlMs);
      if (!allowed) {
        logger.info({ policy, degraded: false }, 'ratelimit: rejected');
      }
      this.record(policy, allowed ? 'allowed' : 'rejected', false);
      return { allowed, retryAfterMs, degraded: false };
    } catch (error) {
      this.recordFailure();
      logger.warn({ policy, error: error instanceof Error ? error.message : String(error) }, 'ratelimit: redis failed, using memory fallback');
      return null;
    }
  }

  private checkMemory(policy: RateLimitPolicy, subject: string): RateLimitDecisionResult {
    const limit = Math.max(1, this.degradedLimit(policy));
    const key = RateLimiter.keyFor(policy, subject);
    const now = Date.now();
    let window = this.memory.get(key);
    if (!window || now >= window.expiresAt) {
      if (!window && this.memory.size >= this.limits.memoryMaxEntries) {
        this.evictExpired(now);
        if (this.memory.size >= this.limits.memoryMaxEntries) {
          this.record(policy, 'allowed', true);
          return { allowed: true, retryAfterMs: 0, degraded: true };
        }
      }
      window = { count: 0, expiresAt: now + this.limits.windowMs };
      this.memory.set(key, window);
    }
    window.count += 1;
    const allowed = window.count <= limit;
    const retryAfterMs = allowed ? 0 : Math.max(1, window.expiresAt - now);
    if (!allowed) {
      logger.info({ policy, degraded: true }, 'ratelimit: rejected');
    }
    this.record(policy, allowed ? 'allowed' : 'rejected', true);
    return { allowed, retryAfterMs, degraded: true };
  }

  private evictExpired(now: number): void {
    for (const [key, window] of this.memory) {
      if (now >= window.expiresAt) {
        this.memory.delete(key);
      }
    }
  }

  private record(policy: RateLimitPolicy, decision: RateLimitDecision, degraded: boolean): void {
    const mode: RateLimitMode = degraded ? 'memory' : 'redis';
    this.metrics?.recordRateLimitDecision(policy, decision, mode);
  }

  private canUseRedis(): boolean {
    if (!this.redis || !this.limits.enabled) {
      return false;
    }
    if (this.breaker.state === 1 && Date.now() - this.breaker.lastFailureAt > BREAKER_RESET_WINDOW_MS) {
      this.breaker.state = 2;
      this.metrics?.setRateLimitBreakerState(2);
    }
    return this.breaker.state !== 1;
  }

  private closeBreaker(): void {
    if (this.breaker.state !== 0) {
      this.breaker.state = 0;
      this.metrics?.setRateLimitBreakerState(0);
    }
    this.breaker.failures = 0;
  }

  private openBreaker(): void {
    this.breaker.state = 1;
    this.breaker.failures = BREAKER_FAILURE_THRESHOLD;
    this.breaker.lastFailureAt = Date.now();
    this.metrics?.setRateLimitBreakerState(1);
  }

  private recordFailure(): void {
    this.breaker.failures += 1;
    this.breaker.lastFailureAt = Date.now();
    if (
      this.breaker.state === 2 ||
      (this.breaker.state === 0 && this.breaker.failures >= BREAKER_FAILURE_THRESHOLD)
    ) {
      this.breaker.state = 1;
      this.metrics?.setRateLimitBreakerState(1);
    }
  }
}

function parseEvalResult(raw: unknown): [count: number, ttlMs: number] {
  if (Array.isArray(raw) && raw.length === 2) {
    const count = Number(raw[0]);
    const ttl = Number(raw[1]);
    if (Number.isFinite(count) && Number.isFinite(ttl)) {
      return [count, ttl];
    }
  }
  return [0, 0];
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`redis timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  });
}

// Derives the caller IP for anonymous quota keys: first X-Forwarded-For
// entry, then X-Real-IP, then the socket address. Unparseable values
// collapse to unknown so a spoofed header can never inject key content.
export function clientIpFromHeaders(
  headers: { get(name: string): string | null | undefined },
  remoteAddr?: string,
): string {
  const forwarded = headers.get('x-forwarded-for') ?? headers.get('X-Forwarded-For');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim() ?? '';
    const normalized = normalizeIp(first);
    if (normalized) {
      return normalized;
    }
  }
  const realIp = headers.get('x-real-ip') ?? headers.get('X-Real-IP');
  if (realIp) {
    const normalized = normalizeIp(realIp.trim());
    if (normalized) {
      return normalized;
    }
  }
  if (remoteAddr) {
    const host = remoteAddr.includes(':') && !remoteAddr.startsWith('[')
      ? (remoteAddr.split(':')[0] ?? '')
      : remoteAddr.replace(/^\[|\]$/g, '').split(':')[0] ?? '';
    const normalized = normalizeIp(host.trim());
    if (normalized) {
      return normalized;
    }
  }
  return 'unknown';
}

function normalizeIp(raw: string): string {
  if (!raw || raw.length > 64 || /[\r\n]/.test(raw)) {
    return '';
  }
  // IPv4 fast path; IPv6 and hostnames pass through verbatim otherwise.
  const v4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(raw)
    && raw.split('.').every((part) => Number(part) <= 255);
  if (v4 || /^[0-9a-fA-F:]+$/.test(raw)) {
    return raw;
  }
  return '';
}
