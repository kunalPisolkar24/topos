import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: env.NODE_ENV !== 'production' ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
            ignore: 'pid,hostname',
            translateTime: 'SYS:standard'
        }
    } : undefined,
    formatters: {
        level: (label) => {
            return { level: label };
        }
    },
    redact: {
        paths: ['password', 'token', 'headers.authorization', 'user.password', 'input.password'],
        remove: true
    },
    base: env.NODE_ENV === 'production' ? undefined : { pid: process.pid, hostname: require('os').hostname() }
});