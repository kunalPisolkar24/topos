import { describe, it, expect } from 'vitest';
import { securityHeaders } from '../security-headers.middleware.js';

const callHandler = (handler: ReturnType<typeof securityHeaders>): { headers: Record<string, unknown> } => {
    const headers: Record<string, unknown> = {};
    const req = { headers: {} } as any;
    const res = {
        setHeader: (k: string, v: unknown) => {
            headers[k.toLowerCase()] = v;
        },
        removeHeader: (k: string) => {
            delete headers[k.toLowerCase()];
        },
    } as any;
    let called = false;
    handler(req, res, () => {
        called = true;
    });
    expect(called).toBe(true);
    return { headers };
};

describe('securityHeaders middleware', () => {
    it('sets standard headers and disables CSP', () => {
        const { headers } = callHandler(securityHeaders({ isProduction: false }));
        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(headers['x-frame-options']).toBe('DENY');
        expect(headers['referrer-policy']).toBe('no-referrer');
        expect(headers['cross-origin-resource-policy']).toBe('cross-origin');
    });

    it('disables HSTS outside production', () => {
        const { headers } = callHandler(securityHeaders({ isProduction: false }));
        const hsts = headers['strict-transport-security'] as string | undefined;
        expect(hsts).toBeDefined();
        expect(hsts).toMatch(/max-age=0/);
    });

    it('enables long-lived HSTS in production', () => {
        const { headers } = callHandler(securityHeaders({ isProduction: true }));
        const hsts = headers['strict-transport-security'] as string;
        expect(hsts).toMatch(/max-age=31536000/);
        expect(hsts).toMatch(/includeSubDomains/);
    });
});
