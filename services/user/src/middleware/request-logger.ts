import { Context, Next } from 'hono';
import { Logger } from 'pino';
import { logger as baseLogger } from '../lib/logger';

declare module 'hono' {
    interface ContextVariableMap {
        requestId: string;
        requestLogger: Logger;
    }
}

export const requestLogger = async (c: Context, next: Next) => {
    const start = Date.now();
    const { method, url } = c.req;
    const userAgent = c.req.header('user-agent');

    const requestId = c.req.header('x-request-id') || crypto.randomUUID();
    const requestBoundLogger = baseLogger.child({ requestId });

    c.set('requestId', requestId);
    c.set('requestLogger', requestBoundLogger);
    c.header('x-request-id', requestId);

    requestBoundLogger.info({
        msg: 'Incoming Request',
        method,
        url,
        userAgent,
    });

    await next();

    const duration = Date.now() - start;
    const status = c.res.status;

    requestBoundLogger.info({
        msg: 'Request Completed',
        method,
        url,
        status,
        duration: `${duration}ms`,
    });
};