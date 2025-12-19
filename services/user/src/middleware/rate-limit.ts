import { Context, Next } from 'hono';
import { Redis } from '@upstash/redis';
import { StatusCode } from '../constants/status-code';
import { env } from '../config/env';
import { logger } from '../lib/logger';

const RATELIMIT_WINDOW_MS = 60000;
const RATELIMIT_MAX_REQUESTS = 50;

let redisInstance: Redis | null = null;

function getRedisClient(): Redis | null {
    if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
        logger.warn('Redis credentials missing, rate limiting disabled');
        return null;
    }

    if (!redisInstance) {
        redisInstance = new Redis({
            url: env.UPSTASH_REDIS_REST_URL,
            token: env.UPSTASH_REDIS_REST_TOKEN,
        });
    }

    return redisInstance;
}

export const rateLimitMiddleware = async (c: Context, next: Next) => {
    const redis = getRedisClient();

    if (!redis) {
        await next();
        return;
    }

    const forwardedFor = c.req.header('x-forwarded-for');
    const cfIp = c.req.header('cf-connecting-ip');

    const ip = forwardedFor
        ? forwardedFor.split(',')[0].trim()
        : (cfIp || 'unknown-ip');

    const key = `rate_limit:user_service:${ip}`;

    try {
        const currentRequests = await redis.incr(key);

        if (currentRequests === 1) {
            await redis.pexpire(key, RATELIMIT_WINDOW_MS);
        }

        if (currentRequests > RATELIMIT_MAX_REQUESTS) {
            logger.warn({ msg: 'Rate limit exceeded', ip });
            return c.json({
                error: 'Too many login/signup attempts. Please try again later.'
            }, StatusCode.RATELIMIT);
        }
    } catch (error) {
        logger.error({ msg: 'Rate limit redis error', error });
    }

    await next();
};