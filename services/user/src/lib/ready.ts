import Keyv from 'keyv';
import { PrismaClient } from '../generated/prisma/client';
import { logger } from './logger';

export interface DependencyCheck {
    name: string;
    ok: boolean;
    latencyMs: number;
    error?: string;
}

export interface ReadinessResult {
    ok: boolean;
    checks: DependencyCheck[];
}

async function checkPrisma(prisma: PrismaClient): Promise<DependencyCheck> {
    const start = Date.now();
    try {
        await prisma.$queryRaw`SELECT 1`;
        return { name: 'database', ok: true, latencyMs: Date.now() - start };
    } catch (error) {
        return {
            name: 'database',
            ok: false,
            latencyMs: Date.now() - start,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

async function checkCache(cache: Keyv): Promise<DependencyCheck> {
    const start = Date.now();
    try {
        const probeKey = `__ready__:${Date.now()}`;
        await cache.set(probeKey, 1, 1000);
        await cache.delete(probeKey);
        return { name: 'cache', ok: true, latencyMs: Date.now() - start };
    } catch (error) {
        return {
            name: 'cache',
            ok: false,
            latencyMs: Date.now() - start,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

export async function checkDependencies(
    prisma: PrismaClient,
    cache: Keyv
): Promise<ReadinessResult> {
    const checks = await Promise.all([checkPrisma(prisma), checkCache(cache)]);
    const ok = checks.every((check) => check.ok);
    if (!ok) {
        logger.warn({ msg: 'Readiness check failed', checks });
    }
    return { ok, checks };
}

export async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            promise,
            new Promise<T>((_, reject) => {
                timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
                timer.unref();
            }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}
