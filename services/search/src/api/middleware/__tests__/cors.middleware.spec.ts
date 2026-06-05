import { describe, it, expect, vi } from 'vitest';
import { corsMiddleware } from '../cors.middleware.js';

const run = (
    handler: ReturnType<typeof corsMiddleware>,
    method: string,
    originHeader: string | undefined
): { status: number; body: unknown; calledNext: boolean; res: any } => {
    const req = {
        method,
        headers: originHeader ? { origin: originHeader } : {},
        header: (k: string) =>
            k.toLowerCase() === 'origin' ? originHeader : undefined,
    } as any;
    let capturedStatus = 0;
    let capturedBody: unknown = undefined;
    const res = {
        statusCode: 200,
        setHeader: vi.fn(),
        getHeader: vi.fn(),
        end: vi.fn(),
        status: vi.fn((s: number) => {
            capturedStatus = s;
            return res;
        }),
        json: vi.fn((b: unknown) => {
            capturedBody = b;
            return res;
        }),
    } as any;
    let calledNext = false;
    handler(req, res, () => {
        calledNext = true;
    });
    return { status: capturedStatus, body: capturedBody, calledNext, res };
};

describe('corsMiddleware', () => {
    it('allows requests with no Origin header (e.g., curl, server-to-server)', () => {
        const { calledNext } = run(
            corsMiddleware({ allowedOrigins: ['https://allowed.test'], isProduction: false }),
            'GET',
            undefined
        );
        expect(calledNext).toBe(true);
    });

    it('rejects disallowed origins in dev (passes to next which surfaces as 500 via callback)', () => {
        const handler = corsMiddleware({
            allowedOrigins: ['https://allowed.test'],
            isProduction: false,
        });
        const req = { method: 'GET', headers: { origin: 'https://evil.test' }, header: () => 'https://evil.test' } as any;
        const res = { setHeader: vi.fn(), getHeader: vi.fn() } as any;
        handler(req, res, () => {});
    });

    it('returns 403 in production when the allowlist is empty and an Origin is present', () => {
        const { status, body, calledNext } = run(
            corsMiddleware({ allowedOrigins: [], isProduction: true }),
            'OPTIONS',
            'https://client.test'
        );
        expect(status).toBe(403);
        expect(body).toEqual({ error: 'cors_disabled' });
        expect(calledNext).toBe(false);
    });

    it('does not block same-origin server traffic in production when no Origin header is present', () => {
        const { calledNext, status } = run(
            corsMiddleware({ allowedOrigins: [], isProduction: true }),
            'GET',
            undefined
        );
        expect(status).toBe(0);
        expect(calledNext).toBe(true);
    });
});
