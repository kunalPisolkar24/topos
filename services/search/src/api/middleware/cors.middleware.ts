import { Request, RequestHandler } from 'express';
import cors, { CorsOptions } from 'cors';

export interface CorsMiddlewareOptions {
    allowedOrigins: string[];
    isProduction: boolean;
}

const isOriginAllowed = (origin: string, allowed: string[]): boolean => {
    return allowed.some((o) => o === origin);
};

export const corsMiddleware = ({
    allowedOrigins,
    isProduction,
}: CorsMiddlewareOptions): RequestHandler => {
    const options: CorsOptions = {
        origin: (origin, callback) => {
            if (!origin) {
                return callback(null, true);
            }
            if (isOriginAllowed(origin, allowedOrigins)) {
                return callback(null, true);
            }
            return callback(new Error('Origin not allowed'), false);
        },
        credentials: false,
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
        exposedHeaders: ['X-Request-Id'],
        maxAge: 600,
    };

    const handler = cors(options);

    return (req: Request, res, next) => {
        if (isProduction && allowedOrigins.length === 0) {
            if (req.method === 'OPTIONS' || req.header('Origin')) {
                res.status(403).json({ error: 'cors_disabled' });
                return;
            }
        }
        handler(req, res, next);
    };
};
