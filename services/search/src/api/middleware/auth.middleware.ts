import { Request, RequestHandler } from 'express';
import { IAuthVerifier, Viewer } from '../../core/interfaces/auth.interface.js';
import { UnauthorizedError } from '../../core/errors/app.error.js';
import { ILogger } from '../../core/interfaces/logger.interface.js';

export interface AuthMiddlewareOptions {
    verifier: IAuthVerifier;
    logger: ILogger;
    enabled: boolean;
}

const extractBearer = (header: string | undefined): string | null => {
    if (!header) return null;
    const trimmed = header.trim();
    if (!/^Bearer\s+/i.test(trimmed)) return null;
    return trimmed.replace(/^Bearer\s+/i, '').trim() || null;
};

export const authMiddleware = ({
    verifier,
    logger,
    enabled,
}: AuthMiddlewareOptions): RequestHandler => {
    if (!enabled) {
        return (req: Request, _res, next) => {
            (req as Request & { viewer?: Viewer }).viewer = undefined;
            next();
        };
    }

    return async (req: Request, res, next) => {
        const token = extractBearer(req.header('Authorization'));
        if (!token) {
            res.status(401).json({ error: 'missing_bearer_token' });
            return;
        }
        try {
            const viewer = await verifier.verify(token);
            (req as Request & { viewer: Viewer }).viewer = viewer;
            next();
        } catch (err) {
            if (err instanceof UnauthorizedError) {
                const log = (req as Request & { log?: ILogger }).log ?? logger;
                log.warn('Auth verification failed', { error: err.message });
                res.status(401).json({ error: 'invalid_token' });
                return;
            }
            next(err);
        }
    };
};
