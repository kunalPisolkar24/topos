import { Request, RequestHandler, Response } from 'express';
import { ICacheService } from '../../core/interfaces/cache.interface.js';
import { ILogger } from '../../core/interfaces/logger.interface.js';

export interface ReadinessChecks {
    cache?: ICacheService;
    es?: { checkHealth: () => Promise<boolean> };
    kafka?: { isHealthy: () => Promise<boolean> };
}

const errorMessage = (err: unknown): string =>
    err instanceof Error ? err.message : String(err);

const withTimeout = async <T>(op: () => Promise<T>, ms: number): Promise<T | null> => {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
    });
    try {
        return await Promise.race([op(), timeout]);
    } finally {
        if (timer) clearTimeout(timer);
    }
};

export const liveness = (): RequestHandler => (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
};

export const readiness = (
    checks: ReadinessChecks,
    logger: ILogger,
    timeoutMs = 2000
): RequestHandler => {
    return async (_req: Request, res: Response) => {
        const results: Record<string, { ok: boolean; detail?: string }> = {};

        if (checks.cache) {
            try {
                const r = await withTimeout(() => checks.cache!.ping(), timeoutMs);
                results.cache = { ok: r !== null };
            } catch (err) {
                results.cache = { ok: false, detail: errorMessage(err) };
            }
        }

        if (checks.es) {
            try {
                const ok = await withTimeout(() => checks.es!.checkHealth(), timeoutMs);
                results.elasticsearch = { ok: ok === true };
            } catch (err) {
                results.elasticsearch = { ok: false, detail: errorMessage(err) };
            }
        }

        if (checks.kafka) {
            try {
                const ok = await withTimeout(() => checks.kafka!.isHealthy(), timeoutMs);
                results.kafka = { ok: ok === true };
            } catch (err) {
                results.kafka = { ok: false, detail: errorMessage(err) };
            }
        }

        const allOk = Object.values(results).every((r) => r.ok);
        if (!allOk) {
            logger.warn('Readiness check failed', { results });
            res.status(503).json({ status: 'unready', checks: results });
            return;
        }
        res.status(200).json({ status: 'ready', checks: results });
    };
};
