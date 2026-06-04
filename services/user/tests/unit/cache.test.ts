import { describe, it, expect, vi, beforeEach } from 'vitest';
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

    it('returns a Keyv instance for service cache (sentinel)', () => {
        mocks.env.REDIS_SENTINELS = 'host:26379';
        const cache = CacheFactory.createServiceCache();
        expect(cache).toBeDefined();
        expect(typeof cache.get).toBe('function');
        expect(typeof cache.set).toBe('function');
    });

    it('returns a Keyv instance for service cache (url)', () => {
        mocks.env.REDIS_URL = 'redis://localhost:6379';
        const cache = CacheFactory.createServiceCache();
        expect(cache).toBeDefined();
    });

    it('returns an in-memory Keyv when no config is set', () => {
        const cache = CacheFactory.createServiceCache();
        expect(cache).toBeDefined();
    });

    it('returns undefined apollo cache for an in-memory service cache', () => {
        const cache = CacheFactory.createServiceCache();
        const apolloCache = CacheFactory.createApolloCache(cache);
        expect(apolloCache).toBeUndefined();
    });
});
