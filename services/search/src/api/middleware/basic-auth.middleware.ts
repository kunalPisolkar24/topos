import { timingSafeEqual } from 'crypto';
import { Request, RequestHandler } from 'express';

export interface BasicAuthOptions {
    credentials?: { username: string; password: string };
    isProduction: boolean;
    realm?: string;
}

const safeEqual = (a: string, b: string): boolean => {
    const ab = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    if (ab.length !== bb.length) {
        timingSafeEqual(ab, ab);
        return false;
    }
    return timingSafeEqual(ab, bb);
};

const parseBasic = (header: string | undefined): { username: string; password: string } | null => {
    if (!header || !header.toLowerCase().startsWith('basic ')) return null;
    const b64 = header.slice(6).trim();
    let decoded: string;
    try {
        decoded = Buffer.from(b64, 'base64').toString('utf8');
    } catch {
        return null;
    }
    const idx = decoded.indexOf(':');
    if (idx < 0) return null;
    return { username: decoded.slice(0, idx), password: decoded.slice(idx + 1) };
};

export const basicAuth = ({
    credentials,
    isProduction,
    realm = 'metrics',
}: BasicAuthOptions): RequestHandler => {
    if (!credentials) {
        if (isProduction) {
            return (_req: Request, res) => {
                res.status(404).json({ error: 'not_found' });
            };
        }
        return (_req: Request, _res, next) => {
            next();
        };
    }

    return (req: Request, res, next) => {
        const supplied = parseBasic(req.header('Authorization'));
        if (!supplied || !safeEqual(supplied.username, credentials.username) || !safeEqual(supplied.password, credentials.password)) {
            res.setHeader('WWW-Authenticate', `Basic realm="${realm}", charset="UTF-8"`);
            res.status(401).json({ error: 'unauthorized' });
            return;
        }
        next();
    };
};
