import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignJWT, generateKeyPair, exportJWK, JWK, CryptoKey } from 'jose';
import { JwksAuthVerifier } from '../jwks-auth-verifier.js';
import { UnauthorizedError } from '../../../core/errors/app.error.js';

interface Harness {
    verifier: JwksAuthVerifier;
    sign: (payload: Record<string, unknown>, options?: { aud?: string; iss?: string; alg?: string; sub?: string; noKid?: boolean }) => Promise<string>;
    kid: string;
}

const buildHarness = async (
    options: {
        audience?: string;
        issuer?: string;
        algorithms?: ('RS256' | 'RS384' | 'RS512' | 'ES256' | 'ES384' | 'ES512')[];
        clockToleranceSec?: number;
    } = {}
): Promise<Harness> => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const pubJwk: JWK = await exportJWK(publicKey);
    const kid = 'test-key-1';
    pubJwk.kid = kid;
    pubJwk.alg = 'RS256';

    const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ keys: [pubJwk] }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const verifier = new JwksAuthVerifier({
        jwksUri: 'https://idp.test/.well-known/jwks.json',
        audience: options.audience,
        issuer: options.issuer,
        algorithms: options.algorithms ?? ['RS256'],
        cacheMaxAgeMs: 60_000,
        clockToleranceSec: options.clockToleranceSec ?? 5,
    });

    const sign: Harness['sign'] = async (payload, opts = {}) => {
        const builder = new SignJWT({ ...payload })
            .setProtectedHeader({
                alg: (opts.alg as any) ?? 'RS256',
                ...(opts.noKid ? {} : { kid }),
            })
            .setIssuedAt()
            .setExpirationTime('5m');
        if (opts.sub) builder.setSubject(opts.sub);
        if (opts.aud) builder.setAudience(opts.aud);
        if (opts.iss) builder.setIssuer(opts.iss);
        return builder.sign(privateKey as CryptoKey);
    };

    return { verifier, sign, kid };
};

describe('JwksAuthVerifier', () => {
    beforeEach(() => {
        vi.unstubAllGlobals();
    });

    it('verifies a valid token and returns the viewer', async () => {
        const h = await buildHarness({ audience: 'search-api', issuer: 'https://idp.test' });
        const token = await h.sign(
            { scope: 'read write' },
            { sub: 'user-1', aud: 'search-api', iss: 'https://idp.test' }
        );
        const viewer = await h.verifier.verify(token);
        expect(viewer.id).toBe('user-1');
        expect(viewer.scopes).toEqual(['read', 'write']);
        expect(viewer.token.iss).toBe('https://idp.test');
    });

    it('parses scope from a string', async () => {
        const h = await buildHarness();
        const token = await h.sign({ scope: 'a b c' }, { sub: 'u' });
        const viewer = await h.verifier.verify(token);
        expect(viewer.scopes).toEqual(['a', 'b', 'c']);
    });

    it('parses scope from an array', async () => {
        const h = await buildHarness();
        const token = await h.sign({ scopes: ['x', 'y'] }, { sub: 'u' });
        const viewer = await h.verifier.verify(token);
        expect(viewer.scopes).toEqual(['x', 'y']);
    });

    it('parses scope from scp array (Azure AD style)', async () => {
        const h = await buildHarness();
        const token = await h.sign({ scp: ['x', 'y'] }, { sub: 'u' });
        const viewer = await h.verifier.verify(token);
        expect(viewer.scopes).toEqual(['x', 'y']);
    });

    it('rejects an empty token', async () => {
        const h = await buildHarness();
        await expect(h.verifier.verify('')).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('rejects a token with the wrong audience', async () => {
        const h = await buildHarness({ audience: 'search-api' });
        const token = await h.sign({}, { sub: 'u', aud: 'other-api' });
        await expect(h.verifier.verify(token)).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('rejects a token with the wrong issuer', async () => {
        const h = await buildHarness({ issuer: 'https://idp.test' });
        const token = await h.sign({}, { sub: 'u', iss: 'https://other.test' });
        await expect(h.verifier.verify(token)).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('rejects a token with a disallowed algorithm', async () => {
        const h = await buildHarness({ algorithms: ['RS384'] });
        const token = await h.sign({}, { sub: 'u' });
        await expect(h.verifier.verify(token)).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('rejects a token whose kid is not in the JWKS', async () => {
        const h = await buildHarness();
        const token = await h.sign({}, { sub: 'u' });
        const parts = token.split('.');
        const header = Buffer.from(parts[0], 'base64url').toString('utf8');
        const tampered = `${Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'unknown-kid' })).toString('base64url')}.${parts[1]}.${parts[2]}`;
        expect(header).toContain('kid');
        await expect(h.verifier.verify(tampered)).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('rejects a token whose subject is missing', async () => {
        const h = await buildHarness();
        const token = await h.sign({}, { sub: undefined as any });
        await expect(h.verifier.verify(token)).rejects.toBeInstanceOf(UnauthorizedError);
    });
});
