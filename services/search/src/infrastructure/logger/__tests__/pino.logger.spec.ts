import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockLoggerInstance = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
};

let capturedOptions: unknown;

vi.mock('pino', () => {
    const mockPino = function (options: unknown) {
        capturedOptions = options;
        return mockLoggerInstance;
    };
    mockPino.stdTimeFunctions = {
        isoTime: () => '',
    };
    return { default: mockPino };
});

import { PinoLogger, type PinoLoggerConfig } from '../pino.logger.js';

const baseConfig: PinoLoggerConfig = {
    service: { name: 'search-service', version: '1.0.0', env: 'test' },
    logging: { level: 'debug' },
};

describe('PinoLogger', () => {
    let logger: PinoLogger;

    beforeEach(() => {
        vi.clearAllMocks();
        capturedOptions = undefined;
        logger = new PinoLogger(baseConfig);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('passes service identity and log level from config to pino', () => {
        const options = capturedOptions as {
            level: string;
            base: Record<string, unknown>;
            redact: { paths: string[] };
        };
        expect(options.level).toBe('debug');
        expect(options.base).toEqual({
            service: 'search-service',
            version: '1.0.0',
            env: 'test',
        });
        expect(options.redact.paths).toEqual(
            expect.arrayContaining(['meta.query', 'meta.token', '*.password', 'meta.password'])
        );
    });

    it('honours a configured log level', () => {
        vi.clearAllMocks();
        capturedOptions = undefined;
        new PinoLogger({
            service: { name: 's', version: 'v', env: 'production' },
            logging: { level: 'warn' },
        });
        const options = capturedOptions as { level: string };
        expect(options.level).toBe('warn');
    });

    describe('info', () => {
        it('should log info message', () => {
            logger.info('Info message');

            expect(mockLoggerInstance.info).toHaveBeenCalledWith({}, 'Info message');
        });

        it('should log info message with metadata', () => {
            const meta = { key: 'value' };
            logger.info('Info message', meta);

            expect(mockLoggerInstance.info).toHaveBeenCalledWith(meta, 'Info message');
        });
    });

    describe('error', () => {
        it('should log error message', () => {
            logger.error('Error message');

            expect(mockLoggerInstance.error).toHaveBeenCalledWith({}, 'Error message');
        });

        it('should log error message with metadata', () => {
            const meta = { error: 'details' };
            logger.error('Error message', meta);

            expect(mockLoggerInstance.error).toHaveBeenCalledWith(meta, 'Error message');
        });
    });

    describe('warn', () => {
        it('should log warn message', () => {
            logger.warn('Warning message');

            expect(mockLoggerInstance.warn).toHaveBeenCalledWith({}, 'Warning message');
        });

        it('should log warn message with metadata', () => {
            const meta = { warning: 'info' };
            logger.warn('Warning message', meta);

            expect(mockLoggerInstance.warn).toHaveBeenCalledWith(meta, 'Warning message');
        });
    });

    describe('debug', () => {
        it('should log debug message', () => {
            logger.debug('Debug message');

            expect(mockLoggerInstance.debug).toHaveBeenCalledWith({}, 'Debug message');
        });

        it('should log debug message with metadata', () => {
            const meta = { debug: 'data' };
            logger.debug('Debug message', meta);

            expect(mockLoggerInstance.debug).toHaveBeenCalledWith(meta, 'Debug message');
        });
    });
});
