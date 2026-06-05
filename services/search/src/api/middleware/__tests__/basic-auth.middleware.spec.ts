import { describe, it, expect, vi } from 'vitest';
import { basicAuth } from '../basic-auth.middleware.js';

const runHandler = (
    handler: ReturnType<typeof basicAuth>,
    authHeader: string | undefined
): { status: number; body?: unknown; wwwAuthenticate?: string; calledNext: boolean } => {
    let capturedStatus = 0;
    let capturedBody: unknown = undefined;
    let capturedWww: string | undefined;
    const req = {
        header: (k: string) => (k.toLowerCase() === 'authorization' ? authHeader : undefined),
    } as any;
    const res = {
        status: vi.fn((s: number) => {
            capturedStatus = s;
            return res;
        }),
        json: vi.fn((b: unknown) => {
            capturedBody = b;
            return res;
        }),
        setHeader: vi.fn((k: string, v: string) => {
            if (k.toLowerCase() === 'www-authenticate') capturedWww = v;
            return res;
        }),
    } as any;
    let calledNext = false;
    handler(req, res, () => {
        calledNext = true;
    });
    return { status: capturedStatus, body: capturedBody, wwwAuthenticate: capturedWww, calledNext };
};

const CREDENTIALS = { username: 'admin', password: 'secret' };
const b64 = (u: string, p: string) => Buffer.from(`${u}:${p}`, 'utf8').toString('base64');

describe('basicAuth middleware', () => {
    describe('no credentials configured', () => {
        it('passes through in development', () => {
            const handler = basicAuth({ isProduction: false });
            const { calledNext, status } = runHandler(handler, undefined);
            expect(calledNext).toBe(true);
            expect(status).toBe(0);
        });

        it('returns 404 in production when no credentials are configured', () => {
            const handler = basicAuth({ isProduction: true });
            const { calledNext, status, body } = runHandler(handler, undefined);
            expect(calledNext).toBe(false);
            expect(status).toBe(404);
            expect(body).toEqual({ error: 'not_found' });
        });
    });

    describe('credentials configured', () => {
        const handler = basicAuth({ isProduction: true, credentials: CREDENTIALS });

        it('accepts matching credentials', () => {
            const { calledNext, status } = runHandler(handler, `Basic ${b64('admin', 'secret')}`);
            expect(calledNext).toBe(true);
            expect(status).toBe(0);
        });

        it('rejects the wrong password with 401 and a WWW-Authenticate header', () => {
            const { calledNext, status, wwwAuthenticate } = runHandler(
                handler,
                `Basic ${b64('admin', 'wrong')}`
            );
            expect(calledNext).toBe(false);
            expect(status).toBe(401);
            expect(wwwAuthenticate).toMatch(/Basic realm=/);
        });

        it('rejects the wrong username with 401', () => {
            const { calledNext, status } = runHandler(handler, `Basic ${b64('other', 'secret')}`);
            expect(calledNext).toBe(false);
            expect(status).toBe(401);
        });

        it('rejects a missing Authorization header with 401', () => {
            const { calledNext, status, wwwAuthenticate } = runHandler(handler, undefined);
            expect(calledNext).toBe(false);
            expect(status).toBe(401);
            expect(wwwAuthenticate).toMatch(/Basic realm=/);
        });

        it('rejects a non-Basic scheme with 401', () => {
            const { calledNext, status } = runHandler(handler, 'Bearer abc');
            expect(calledNext).toBe(false);
            expect(status).toBe(401);
        });

        it('rejects a malformed Basic value with 401', () => {
            const { calledNext, status } = runHandler(handler, 'Basic notbase64');
            expect(calledNext).toBe(false);
            expect(status).toBe(401);
        });
    });
});
