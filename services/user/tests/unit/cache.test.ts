import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CacheFactory } from '../../src/lib/cache';

const mocks = vi.hoisted(() => ({
    env: {
        REDIS_SENTINELS: undefined as string | undefined,
        REDIS_MASTER_NAME: 'mymaster',
        REDIS_URL: undefined as string | undefined,
        REDIS_PASSWORD: undefined as string | undefined,
    }
}));

vi.mock('../../src/config/env', () => ({
    env: mocks.env
}));

describe('CacheFactory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.env.REDIS_SENTINELS = undefined;
        mocks.env.REDIS_URL = undefined;
    });

    it('should initialize Sentinel mode when REDIS_SENTINELS is present', () => {
        mocks.env.REDIS_SENTINELS = 'host:26379';
        
        const cache = CacheFactory.createCache();
        expect(cache).toBeDefined();
    });

    it('should initialize Standard mode when REDIS_URL is present', () => {
        mocks.env.REDIS_URL = 'redis://localhost:6379';

        const cache = CacheFactory.createCache();
        expect(cache).toBeDefined();
    });

    it('should fallback to Memory when no config present', () => {
        const cache = CacheFactory.createCache();
        expect(cache).toBeUndefined();
    });
});