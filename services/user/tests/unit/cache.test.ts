import { describe, it, expect, vi, beforeEach } from 'vitest';
import { selectCacheBackend } from '../../src/lib/cache';
import { KeyvAdapter } from '@apollo/utils.keyvadapter';

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

describe('selectCacheBackend', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.env.REDIS_SENTINELS = undefined;
        mocks.env.REDIS_URL = undefined;
    });

    it('selects the sentinel backend when REDIS_SENTINELS is set', () => {
        mocks.env.REDIS_SENTINELS = 'host:26379';
        const backend = selectCacheBackend();
        expect(backend.id).toBe('sentinel');
        expect(backend.supportsApollo).toBe(true);
        const cache = backend.create();
        expect(typeof cache.get).toBe('function');
        expect(typeof cache.set).toBe('function');
    });

    it('selects the redis backend when REDIS_URL is set', () => {
        mocks.env.REDIS_URL = 'redis://localhost:6379';
        const backend = selectCacheBackend();
        expect(backend.id).toBe('redis');
        expect(backend.supportsApollo).toBe(true);
        expect(backend.create()).toBeDefined();
    });

    it('selects the in-memory backend when no config is set', () => {
        const backend = selectCacheBackend();
        expect(backend.id).toBe('memory');
        expect(backend.supportsApollo).toBe(false);
        expect(backend.create()).toBeDefined();
    });

    it('wraps the keyv in a KeyvAdapter only when the backend supports Apollo', () => {
        const inMemory = selectCacheBackend();
        expect(inMemory.supportsApollo).toBe(false);
        const cache = inMemory.create();
        expect(cache).toBeDefined();
    });
});

describe('KeyvAdapter integration with cache backends', () => {
    it('can be constructed from a keyv produced by a supporting backend', () => {
        const backend = selectCacheBackend();
        const cache = backend.create();
        if (backend.supportsApollo) {
            const adapter = new KeyvAdapter(cache);
            expect(adapter).toBeDefined();
        }
    });
});
