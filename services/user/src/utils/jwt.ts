import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { logger } from '../lib/logger';

export interface UserPayload {
    id: number;
}

export class JwtUtils {
    static sign(payload: UserPayload): string {
        return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });
    }

    static verify(token: string): UserPayload | null {
        try {
            return jwt.verify(token, env.JWT_SECRET) as UserPayload;
        } catch (error) {
            logger.debug({ msg: 'JWT Verification failed', error });
            return null;
        }
    }
}