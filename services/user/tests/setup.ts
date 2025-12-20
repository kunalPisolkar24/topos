import { vi } from 'vitest';

process.env.JWT_SECRET = 'test-jwt-secret';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.UPSTASH_REDIS_REST_URL = 'https://mock-redis.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-token';

vi.mock('@upstash/redis', () => {
    return {
        Redis: class MockRedis {
            constructor() {}
            async incr() { return 1; }
            async pexpire() { return 1; }
        }
    };
});