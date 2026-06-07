import { createRemoteJWKSet, jwtVerify, JWTPayload, JWTVerifyGetKey, JWTVerifyOptions } from 'jose';
import type { IAuthVerifier, Viewer } from '../../core/interfaces/auth.interface.js';
import { UnauthorizedError } from '../../core/errors/app.error.js';
import type { Algorithm } from '../../core/interfaces/config.interface.js';

export interface JwksAuthVerifierOptions {
    jwksUri: string;
    audience?: string;
    issuer?: string;
    algorithms: Algorithm[];
    cacheMaxAgeMs: number;
    clockToleranceSec: number;
}

const extractScopes = (payload: JWTPayload): string[] => {
    if (typeof payload.scope === 'string') {
        return payload.scope.split(/\s+/).filter(Boolean);
    }
    if (Array.isArray(payload.scopes)) {
        return payload.scopes.filter((s): s is string => typeof s === 'string');
    }
    if (Array.isArray((payload as Record<string, unknown>).scp)) {
        return ((payload as Record<string, unknown>).scp as unknown[])
            .filter((s): s is string => typeof s === 'string');
    }
    return [];
};

const extractSubject = (payload: JWTPayload): string => {
    const sub = payload.sub;
    if (typeof sub === 'string' && sub.length > 0) return sub;
    throw new UnauthorizedError('Invalid token: missing subject');
};

export class JwksAuthVerifier implements IAuthVerifier {
    private readonly jwks: JWTVerifyGetKey;
    private readonly verifyOptions: JWTVerifyOptions;

    constructor(options: JwksAuthVerifierOptions) {
        this.jwks = createRemoteJWKSet(new URL(options.jwksUri), {
            cacheMaxAge: options.cacheMaxAgeMs,
            cooldownDuration: 30_000,
        });
        this.verifyOptions = {
            algorithms: options.algorithms,
            audience: options.audience,
            issuer: options.issuer,
            clockTolerance: options.clockToleranceSec,
        };
    }

    async verify(token: string): Promise<Viewer> {
        if (typeof token !== 'string' || token.length === 0) {
            throw new UnauthorizedError('Missing token');
        }
        let result;
        try {
            result = await jwtVerify(token, this.jwks, this.verifyOptions);
        } catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            throw new UnauthorizedError(`Invalid token: ${detail || 'verification failed'}`);
        }
        const payload = result.payload as JWTPayload;
        return {
            id: extractSubject(payload),
            scopes: extractScopes(payload),
            token: payload,
        };
    }
}
