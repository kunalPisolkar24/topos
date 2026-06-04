import { describe, it, expect, vi } from 'vitest';
import Keyv from 'keyv';
import { checkDependencies, withTimeout } from '../../src/lib/ready';
import { PrismaClient } from '../../src/generated/prisma/client';

describe('checkDependencies', () => {
    it('reports healthy when both checks pass', async () => {
        const prisma = {
            $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
        } as unknown as PrismaClient;
        const cache = new Keyv();
        const result = await checkDependencies(prisma, cache);
        expect(result.ok).toBe(true);
        expect(result.checks).toEqual([
            expect.objectContaining({ name: 'database', ok: true }),
            expect.objectContaining({ name: 'cache', ok: true }),
        ]);
    });

    it('reports unhealthy when prisma check fails', async () => {
        const prisma = {
            $queryRaw: vi.fn().mockRejectedValue(new Error('connection refused')),
        } as unknown as PrismaClient;
        const cache = new Keyv();
        const result = await checkDependencies(prisma, cache);
        expect(result.ok).toBe(false);
        expect(result.checks[0]).toMatchObject({ name: 'database', ok: false, error: 'connection refused' });
        expect(result.checks[1]).toMatchObject({ name: 'cache', ok: true });
    });

    it('reports unhealthy when cache check fails', async () => {
        const prisma = {
            $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
        } as unknown as PrismaClient;
        const failingCache = {
            set: vi.fn().mockRejectedValue(new Error('redis down')),
            delete: vi.fn().mockResolvedValue(undefined),
        } as unknown as Keyv;
        const result = await checkDependencies(prisma, failingCache);
        expect(result.ok).toBe(false);
        expect(result.checks[0]).toMatchObject({ name: 'database', ok: true });
        expect(result.checks[1]).toMatchObject({ name: 'cache', ok: false, error: 'redis down' });
    });
});

describe('withTimeout', () => {
    it('resolves with the value when the promise wins the race', async () => {
        const result = await withTimeout(Promise.resolve('ok'), 100);
        expect(result).toBe('ok');
    });

    it('rejects with a timeout error when the promise is too slow', async () => {
        await expect(withTimeout(new Promise(() => {}), 25)).rejects.toThrow(/Timed out/);
    });

    it('clears the timer when the promise resolves first', async () => {
        const clearSpy = vi.spyOn(global, 'clearTimeout');
        await withTimeout(Promise.resolve('ok'), 1000);
        expect(clearSpy).toHaveBeenCalled();
        clearSpy.mockRestore();
    });
});
