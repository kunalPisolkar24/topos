import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';
import { ILogger } from '../../../core/interfaces/logger.interface.js';
import type { RedisConfig } from '../redis.cache.js';

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockQuit = vi.fn();
const mockOn = vi.fn();
const mockOnce = vi.fn();
let mockStatus = 'ready';
let capturedErrorHandler: ((err: Error) => void) | null = null;
let capturedRetryStrategy: ((times: number) => number) | null = null;

vi.mock('ioredis', () => {
    return {
        Redis: class MockRedis {
            get = mockGet;
            set = mockSet;
            quit = mockQuit;
            on = (event: string, handler: (err: Error) => void) => {
                if (event === 'error') {
                    capturedErrorHandler = handler;
                }
                return mockOn(event, handler);
            };
            once = mockOnce;
            get status() {
                return mockStatus;
            }
            constructor(...args: any[]) {
                const config = args.find(
                    (a) => a && typeof a === 'object' && 'retryStrategy' in a
                );
                if (config && config.retryStrategy) {
                    capturedRetryStrategy = config.retryStrategy;
                }
            }
        },
    };
});

import { RedisCache } from '../redis.cache.js';

const standaloneConfig: RedisConfig = {
    url: 'redis://localhost:6379',
    sentinelMasterName: 'mymaster',
};

const sentinelConfig: RedisConfig = {
    sentinelHosts: [{ host: 'localhost', port: 26379 }],
    sentinelMasterName: 'mymaster',
};

describe('RedisCache', () => {
    let logger: MockProxy<ILogger>;

    beforeEach(() => {
        vi.clearAllMocks();
        logger = mock<ILogger>();
        mockStatus = 'ready';
        capturedErrorHandler = null;
        capturedRetryStrategy = null;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('standalone client', () => {
        let redisCache: RedisCache;

        beforeEach(() => {
            redisCache = new RedisCache(standaloneConfig, logger);
        });

        describe('constructor', () => {
            it('should set up error handler that logs errors', () => {
                expect(capturedErrorHandler).not.toBeNull();

                const testError = new Error('Connection dropped');
                capturedErrorHandler!(testError);

                expect(logger.error).toHaveBeenCalledWith('Redis Client Error', {
                    error: 'Connection dropped',
                });
            });

            it('should set up retry strategy with exponential backoff capped at 2000ms', () => {
                expect(capturedRetryStrategy).not.toBeNull();

                expect(capturedRetryStrategy!(1)).toBe(50);
                expect(capturedRetryStrategy!(10)).toBe(500);
                expect(capturedRetryStrategy!(40)).toBe(2000);
                expect(capturedRetryStrategy!(100)).toBe(2000);
            });
        });

        describe('get', () => {
            it('should get value from redis', async () => {
                mockGet.mockResolvedValue('value');

                const result = await redisCache.get('key');

                expect(result).toBe('value');
                expect(mockGet).toHaveBeenCalledWith('key');
            });

            it('should return null for non-existent key', async () => {
                mockGet.mockResolvedValue(null);

                const result = await redisCache.get('non-existent');

                expect(result).toBeNull();
            });
        });

        describe('set', () => {
            it('should set value without TTL', async () => {
                await redisCache.set('key', 'value');

                expect(mockSet).toHaveBeenCalledWith('key', 'value');
            });

            it('should set value with TTL', async () => {
                await redisCache.set('key', 'value', 10);

                expect(mockSet).toHaveBeenCalledWith('key', 'value', 'EX', 10);
            });
        });

        describe('connect', () => {
            it('should return immediately if already connected', async () => {
                mockStatus = 'ready';

                await redisCache.connect();

                expect(mockOnce).not.toHaveBeenCalled();
            });

            it('should wait for ready event when not connected', async () => {
                mockStatus = 'connecting';

                mockOnce.mockImplementation((event: string, callback: () => void) => {
                    if (event === 'ready') {
                        setTimeout(() => callback(), 10);
                    }
                    return { once: mockOnce };
                });

                await redisCache.connect();

                expect(logger.info).toHaveBeenCalledWith('Redis Connected');
            });

            it('should reject on connection error during connect', async () => {
                mockStatus = 'connecting';

                mockOnce.mockImplementation(
                    (event: string, callback: (err?: Error) => void) => {
                        if (event === 'error') {
                            setTimeout(() => callback(new Error('Connection refused')), 10);
                        }
                        return { once: mockOnce };
                    }
                );

                await expect(redisCache.connect()).rejects.toThrow('Connection refused');
            });
        });

        describe('disconnect', () => {
            it('should disconnect', async () => {
                await redisCache.disconnect();

                expect(mockQuit).toHaveBeenCalled();
                expect(logger.info).toHaveBeenCalledWith('Redis Disconnected');
            });
        });
    });

    describe('sentinel client', () => {
        it('constructs a sentinel-backed client', () => {
            const redisCache = new RedisCache(sentinelConfig, logger);
            expect(redisCache).toBeInstanceOf(RedisCache);
        });

        it('honours sentinelTls when set', () => {
            const tlsSentinelConfig: RedisConfig = {
                ...sentinelConfig,
                sentinelTls: true,
                password: 'pw',
                sentinelPassword: 'spw',
            };
            const redisCache = new RedisCache(tlsSentinelConfig, logger);
            expect(redisCache).toBeInstanceOf(RedisCache);
        });
    });

    describe('configuration errors', () => {
        it('throws when neither url nor sentinel hosts are provided', () => {
            const empty: RedisConfig = { sentinelMasterName: 'mymaster' };
            expect(() => new RedisCache(empty, logger)).toThrow(
                'RedisCache requires either redisConfig.url or redisConfig.sentinelHosts'
            );
        });
    });
});
