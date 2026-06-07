import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';
import { logger } from '../lib/logger';

export interface UserPayload {
    id: number;
    iat?: number;
    exp?: number;
}

const userPayloadSchema = z.object({
    id: z.number().int().positive(),
    iat: z.number().optional(),
    exp: z.number().optional(),
});

export interface TokenService {
    sign(payload: { id: number }): string;
    verify(token: string): UserPayload | null;
}

export class JwtTokenService implements TokenService {
    private readonly signOptions: jwt.SignOptions;
    private readonly verifyOptions: jwt.VerifyOptions;

    constructor(
        private readonly secret: string = env.JWT_SECRET,
        private readonly issuer: string = env.JWT_ISSUER,
        private readonly audience: string = env.JWT_AUDIENCE,
        private readonly expiresIn: jwt.SignOptions['expiresIn'] = env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']
    ) {
        this.signOptions = {
            algorithm: 'HS256',
            expiresIn: this.expiresIn,
            issuer: this.issuer,
            audience: this.audience,
        };
        this.verifyOptions = {
            algorithms: ['HS256'],
            issuer: this.issuer,
            audience: this.audience,
        };
    }

    sign(payload: { id: number }): string {
        return jwt.sign({ id: payload.id }, this.secret, this.signOptions);
    }

    verify(token: string): UserPayload | null {
        let decoded: unknown;
        try {
            decoded = jwt.verify(token, this.secret, this.verifyOptions);
        } catch (error) {
            logger.debug({ msg: 'JWT verification failed', error });
            return null;
        }

        const parsed = userPayloadSchema.safeParse(decoded);
        if (!parsed.success) {
            logger.warn({ msg: 'JWT payload shape invalid', issues: parsed.error.issues });
            return null;
        }

        return parsed.data;
    }
}

export const tokenService: TokenService = new JwtTokenService();
