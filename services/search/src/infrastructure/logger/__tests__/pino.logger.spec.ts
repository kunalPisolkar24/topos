import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockLoggerInstance = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
};

vi.mock('pino', () => {
    const mockPino = function () {
        return mockLoggerInstance;
    };
    mockPino.stdTimeFunctions = {
        isoTime: () => ''
    };
    return { default: mockPino };
});

import { PinoLogger } from '../pino.logger.js';

describe('PinoLogger', () => {
    let logger: PinoLogger;

    beforeEach(() => {
        vi.clearAllMocks();
        logger = new PinoLogger();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('info', () => {
        it('should log info message', () => {
            logger.info('Info message');

            expect(mockLoggerInstance.info).toHaveBeenCalledWith(undefined, 'Info message');
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

            expect(mockLoggerInstance.error).toHaveBeenCalledWith(undefined, 'Error message');
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

            expect(mockLoggerInstance.warn).toHaveBeenCalledWith(undefined, 'Warning message');
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

            expect(mockLoggerInstance.debug).toHaveBeenCalledWith(undefined, 'Debug message');
        });

        it('should log debug message with metadata', () => {
            const meta = { debug: 'data' };
            logger.debug('Debug message', meta);

            expect(mockLoggerInstance.debug).toHaveBeenCalledWith(meta, 'Debug message');
        });
    });
});
