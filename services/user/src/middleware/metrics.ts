import { Context, Next } from 'hono';
import { metrics } from '../lib/metrics';

const EXCLUDED_PATHS = new Set(['/metrics', '/health', '/ready']);

export const metricsMiddleware = async (c: Context, next: Next) => {
    const start = process.hrtime();

    await next();

    const path = c.req.path;
    if (EXCLUDED_PATHS.has(path)) {
        return;
    }

    const [seconds, nanoseconds] = process.hrtime(start);
    const duration = seconds + nanoseconds / 1e9;

    const { method } = c.req;
    const status = c.res.status;
    const route = c.req.routePath || path;

    metrics.httpRequestDuration.observe(
        { method, route, status_code: status.toString() },
        duration
    );
};