import { Context, Next } from 'hono';
import { logger } from '../lib/logger';

export const requestLogger = async (c: Context, next: Next) => {
    const start = Date.now();
    const { method, url } = c.req;
    const userAgent = c.req.header('user-agent');
    
    const requestId = c.req.header('x-request-id') || crypto.randomUUID();
    c.set('requestId', requestId);

    logger.info({
        msg: 'Incoming Request',
        method,
        url,
        requestId,
        userAgent
    });

    await next();

    const duration = Date.now() - start;
    const status = c.res.status;

    logger.info({
        msg: 'Request Completed',
        method,
        url,
        status,
        duration: `${duration}ms`,
        requestId
    });
};