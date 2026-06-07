import os from 'os';
import pino from 'pino';
import { env } from '../config/env';

const isProduction = env.NODE_ENV === 'production';

const createTransport = () => {
    if (isProduction) {
        return undefined;
    }

    try {
        require.resolve('pino-pretty');
        return {
            target: 'pino-pretty',
            options: {
                colorize: true,
                ignore: 'pid,hostname',
                translateTime: 'SYS:standard'
            }
        };
    } catch {
        return undefined;
    }
};

export const logger = pino({
    level: isProduction ? 'info' : 'debug',
    transport: createTransport(),
    formatters: {
        level: (label) => {
            return { level: label };
        }
    },
    redact: {
        paths: ['password', 'token', 'headers.authorization', 'user.password', 'input.password'],
        remove: true
    },
    base: isProduction ? undefined : { pid: process.pid, hostname: os.hostname() }
});
