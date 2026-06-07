import { describe, it, expect, vi } from 'vitest';
import { CacheAside } from '../../src/lib/cacheAside';
import Keyv from 'keyv';

describe('CacheAside', () => {
    const options = {
        userTtlMs: 60_000,
        missingUserTtlMs: 5_000,
        keyPrefix: 'test:v1',
    };

    function createCache(): Keyv {
        return new Keyv();
    }

    it('caches the loader result on first read', async () => {
        const cache = createCache();
        const aside = new CacheAside<number, { id: number }>(cache, options);
        const loader = vi.fn().mockResolvedValue({ id: 1 });

        await aside.getOrLoad(1, loader);
        await aside.getOrLoad(1, loader);
        await aside.getOrLoad(1, loader);

        expect(loader).toHaveBeenCalledTimes(1);
    });

    it('coalesces concurrent loads for the same key', async () => {
        const cache = createCache();
        const aside = new CacheAside<number, { id: number }>(cache, options);
        let resolveLoader!: (value: { id: number } | null) => void;
        const loader = vi.fn().mockImplementation(
            () =>
                new Promise<{ id: number } | null>((resolve) => {
                    resolveLoader = resolve;
                })
        );

        const promises: Promise<{ id: number } | null>[] = [];
        await new Promise<void>((resolveOuter) => {
            promises.push(aside.getOrLoad(1, loader));
            promises.push(aside.getOrLoad(1, loader));
            promises.push(aside.getOrLoad(1, loader));
            setImmediate(() => {
                resolveLoader({ id: 1 });
                resolveOuter();
            });
        });
        const results = await Promise.all(promises);

        expect(loader).toHaveBeenCalledTimes(1);
        expect(results).toEqual([{ id: 1 }, { id: 1 }, { id: 1 }]);
    });

    it('caches a negative result and skips future loads', async () => {
        const cache = createCache();
        const aside = new CacheAside<number, { id: number }>(cache, options);
        const loader = vi.fn().mockResolvedValue(null);

        await aside.getOrLoad(1, loader);
        await aside.getOrLoad(1, loader);
        await aside.getOrLoad(1, loader);

        expect(loader).toHaveBeenCalledTimes(1);
    });

    it('propagates loader errors without poisoning the cache', async () => {
        const cache = createCache();
        const aside = new CacheAside<number, { id: number }>(cache, options);
        const loader = vi
            .fn()
            .mockRejectedValueOnce(new Error('boom'))
            .mockResolvedValueOnce({ id: 1 });

        await expect(aside.getOrLoad(1, loader)).rejects.toThrow('boom');
        await expect(aside.getOrLoad(1, loader)).resolves.toEqual({ id: 1 });
        expect(loader).toHaveBeenCalledTimes(2);
    });

    it('getOrLoadMany batches only the missing ids', async () => {
        const cache = createCache();
        const aside = new CacheAside<number, { id: number }>(cache, options);

        await aside.warm(1, { id: 1 });

        const batchLoader = vi.fn().mockResolvedValue([{ id: 2 }, { id: 3 }]);

        const result = await aside.getOrLoadMany([1, 2, 3], batchLoader);

        expect(batchLoader).toHaveBeenCalledWith([2, 3]);
        expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    });

    it('returns an empty array for an empty id list', async () => {
        const cache = createCache();
        const aside = new CacheAside<number, { id: number }>(cache, options);
        const batchLoader = vi.fn();

        const result = await aside.getOrLoadMany([] as readonly number[], batchLoader);
        expect(result).toEqual([]);
        expect(batchLoader).not.toHaveBeenCalled();
    });

    it('invalidate removes the cached entry', async () => {
        const cache = createCache();
        const aside = new CacheAside<number, { id: number }>(cache, options);
        const loader = vi.fn().mockResolvedValue({ id: 1 });

        await aside.getOrLoad(1, loader);
        await aside.invalidate(1);
        await aside.getOrLoad(1, loader);

        expect(loader).toHaveBeenCalledTimes(2);
    });
});
