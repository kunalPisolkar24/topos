import pino, { type LoggerOptions } from 'pino';
import { ILogger } from '../../core/interfaces/logger.interface.js';

export interface PinoLoggerConfig {
    service: { name: string; version: string; env: 'development' | 'production' | 'test' };
    logging: { level: string };
}

export class PinoLogger implements ILogger {
    private readonly logger: pino.Logger;

    constructor(config: PinoLoggerConfig) {
        const options: LoggerOptions = {
            level: config.logging.level,
            base: {
                service: config.service.name,
                version: config.service.version,
                env: config.service.env,
            },
            timestamp: pino.stdTimeFunctions.isoTime,
            redact: {
                paths: ['meta.query', 'meta.token', '*.password', 'meta.password'],
                censor: '[REDACTED]',
            },
        };
        this.logger = pino(options);
    }

    info(message: string, meta?: Record<string, unknown>): void {
        this.logger.info(meta ?? {}, message);
    }

    error(message: string, meta?: Record<string, unknown>): void {
        this.logger.error(meta ?? {}, message);
    }

    warn(message: string, meta?: Record<string, unknown>): void {
        this.logger.warn(meta ?? {}, message);
    }

    debug(message: string, meta?: Record<string, unknown>): void {
        this.logger.debug(meta ?? {}, message);
    }

    child(bindings: Record<string, unknown>): ILogger {
        return new PinoLoggerFromPino(this.logger.child(bindings));
    }
}

class PinoLoggerFromPino implements ILogger {
    constructor(private readonly inner: pino.Logger) {}

    info(message: string, meta?: Record<string, unknown>): void {
        this.inner.info(meta ?? {}, message);
    }
    error(message: string, meta?: Record<string, unknown>): void {
        this.inner.error(meta ?? {}, message);
    }
    warn(message: string, meta?: Record<string, unknown>): void {
        this.inner.warn(meta ?? {}, message);
    }
    debug(message: string, meta?: Record<string, unknown>): void {
        this.inner.debug(meta ?? {}, message);
    }
    child(bindings: Record<string, unknown>): ILogger {
        return new PinoLoggerFromPino(this.inner.child(bindings));
    }
}
