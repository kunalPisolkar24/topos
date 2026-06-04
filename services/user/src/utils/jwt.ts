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

const SIGN_OPTIONS: jwt.SignOptions = {
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
};

const VERIFY_OPTIONS: jwt.VerifyOptions = {
    algorithms: ['HS256'],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
};

export class JwtUtils {
    static sign(payload: UserPayload): string {
        return jwt.sign({ id: payload.id }, env.JWT_SECRET, SIGN_OPTIONS);
    }

    static verify(token: string): UserPayload | null {
        let decoded: unknown;
        try {
            decoded = jwt.verify(token, env.JWT_SECRET, VERIFY_OPTIONS);
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
