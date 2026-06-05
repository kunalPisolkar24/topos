import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';
import { liveness, readiness } from '../health.middleware.js';
import { ICacheService } from '../../../core/interfaces/cache.interface.js';
import { ILogger } from '../../../core/interfaces/logger.interface.js';

const capture = (): { res: any; snapshot: () => { status: number; body: any } } => {
    let capturedStatus = 0;
    let capturedBody: any = undefined;
    const res = {
        status: vi.fn((s: number) => {
            capturedStatus = s;
            return res;
        }),
        json: vi.fn((b: any) => {
            capturedBody = b;
            return res;
        }),
    } as any;
    return {
        res,
        snapshot: () => ({ status: capturedStatus, body: capturedBody }),
    };
};

describe('liveness', () => {
    it('returns 200 with status ok', () => {
        const { res, snapshot } = capture();
        liveness()({} as any, res, () => {});
        const s = snapshot();
        expect(s.status).toBe(200);
        expect(s.body).toEqual({ status: 'ok' });
    });
});

describe('readiness', () => {
    let cache: MockProxy<ICacheService>;
    let logger: MockProxy<ILogger>;
    let es: { checkHealth: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        cache = mock<ICacheService>();
        logger = mock<ILogger>();
        es = { checkHealth: vi.fn() };
    });

    it('returns 200 ready when all checks pass', async () => {
        cache.ping.mockResolvedValue(undefined as any);
        (es.checkHealth as any).mockResolvedValue(true);
        const { res, snapshot } = capture();

        await readiness({ cache, es: es as any }, logger)({} as any, res, () => {});

        const s = snapshot();
        expect(s.status).toBe(200);
        expect(s.body).toEqual({
            status: 'ready',
            checks: {
                cache: { ok: true },
                elasticsearch: { ok: true },
            },
        });
    });

    it('returns 503 when the cache ping fails', async () => {
        cache.ping.mockRejectedValue(new Error('connection lost'));
        (es.checkHealth as any).mockResolvedValue(true);
        const { res, snapshot } = capture();

        await readiness({ cache, es: es as any }, logger)({} as any, res, () => {});

        expect(snapshot().status).toBe(503);
    });

    it('returns 503 when ES checkHealth returns false', async () => {
        cache.ping.mockResolvedValue(undefined as any);
        (es.checkHealth as any).mockResolvedValue(false);
        const { res, snapshot } = capture();

        await readiness({ cache, es: es as any }, logger)({} as any, res, () => {});

        expect(snapshot().status).toBe(503);
    });

    it('returns 503 when the cache ping times out', async () => {
        cache.ping.mockImplementation(
            () => new Promise((resolve) => setTimeout(() => resolve('PONG' as any), 100))
        );
        (es.checkHealth as any).mockResolvedValue(true);
        const { res, snapshot } = capture();

        await readiness({ cache, es: es as any }, logger, 10)({} as any, res, () => {});

        expect(snapshot().status).toBe(503);
    });

    it('handles missing checks gracefully', async () => {
        const { res, snapshot } = capture();
        await readiness({}, logger)({} as any, res, () => {});

        const s = snapshot();
        expect(s.status).toBe(200);
        expect(s.body).toEqual({ status: 'ready', checks: {} });
    });
});
