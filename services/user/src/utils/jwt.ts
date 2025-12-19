import jwt from 'jsonwebtoken';
import { env } from '../config/env';

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
        } catch {
            return null;
        }
    }
}