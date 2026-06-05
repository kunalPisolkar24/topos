import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';
import { authMiddleware } from '../auth.middleware.js';
import { IAuthVerifier, Viewer } from '../../../core/interfaces/auth.interface.js';
import { UnauthorizedError } from '../../../core/errors/app.error.js';
import { ILogger } from '../../../core/interfaces/logger.interface.js';

const capture = () => {
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

const buildReq = (authorization?: string, requestLog?: ILogger) => {
    const req: any = {
        header: (k: string) =>
            k.toLowerCase() === 'authorization' ? authorization : undefined,
    };
    if (requestLog) req.log = requestLog;
    return req;
};

describe('authMiddleware', () => {
    let verifier: MockProxy<IAuthVerifier>;
    let logger: MockProxy<ILogger>;

    beforeEach(() => {
        verifier = mock<IAuthVerifier>();
        logger = mock<ILogger>();
    });

    describe('disabled', () => {
        it('passes through with viewer=undefined', async () => {
            const mw = authMiddleware({ verifier, logger, enabled: false });
            const req = buildReq();
            let next = false;
            await new Promise<void>((resolve) => mw(req, {} as any, () => { next = true; resolve(); }));
            expect(next).toBe(true);
            expect(req.viewer).toBeUndefined();
        });
    });

    describe('enabled', () => {
        const mw = () => authMiddleware({ verifier, logger, enabled: true });

        it('returns 401 when no Authorization header is present', async () => {
            const { res, snapshot } = capture();
            let next = false;
            await mw()(buildReq(), res, () => { next = true; });
            expect(next).toBe(false);
            const s = snapshot();
            expect(s.status).toBe(401);
            expect(s.body).toEqual({ error: 'missing_bearer_token' });
        });

        it('returns 401 when the header is not Bearer', async () => {
            const { res, snapshot } = capture();
            let next = false;
            await mw()(buildReq('Basic dXNlcjpwYXNz'), res, () => { next = true; });
            expect(next).toBe(false);
            expect(snapshot().status).toBe(401);
        });

        it('returns 401 when the verifier throws UnauthorizedError', async () => {
            verifier.verify.mockRejectedValue(new UnauthorizedError('bad'));
            const { res, snapshot } = capture();
            let next = false;
            await mw()(buildReq('Bearer abc'), res, () => { next = true; });
            expect(next).toBe(false);
            expect(snapshot().status).toBe(401);
            expect(snapshot().body).toEqual({ error: 'invalid_token' });
        });

        it('attaches the viewer and calls next on a valid token', async () => {
            const viewer: Viewer = { id: 'user-1', scopes: ['read'], token: { sub: 'user-1' } };
            verifier.verify.mockResolvedValue(viewer);
            const { res } = capture();
            const req = buildReq('Bearer abc');
            let next = false;
            await mw()(req, res, () => { next = true; });
            expect(next).toBe(true);
            expect(req.viewer).toBe(viewer);
        });

        it('forwards non-auth errors to next', async () => {
            const boom = new Error('boom');
            verifier.verify.mockRejectedValue(boom);
            const { res } = capture();
            let received: unknown = null;
            await mw()(buildReq('Bearer abc'), res, (err) => { received = err; });
            expect(received).toBe(boom);
        });
    });
});
