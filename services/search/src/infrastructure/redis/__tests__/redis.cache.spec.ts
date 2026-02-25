import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';
import { ILogger } from '../../../core/interfaces/logger.interface.js';

vi.mock('../../../config/index.js', () => ({
  getSharedConfig: () => ({
    NODE_ENV: 'test',
    ELASTICSEARCH_URL: 'http://localhost:9200',
    ELASTICSEARCH_INDEX: 'test_index',
    REDIS_SENTINEL_HOSTS: 'localhost:26379',
    REDIS_MASTER_NAME: 'mymaster'
  })
}));

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
      get status() { return mockStatus; }
      constructor(config: any) {
        if (config && config.retryStrategy) {
          capturedRetryStrategy = config.retryStrategy;
        }
      }
    }
  };
});

import { RedisCache } from '../redis.cache.js';

describe('RedisCache', () => {
  let redisCache: RedisCache;
  let logger: MockProxy<ILogger>;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = mock<ILogger>();
    mockStatus = 'ready';
    capturedErrorHandler = null;
    capturedRetryStrategy = null;
    redisCache = new RedisCache(logger);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should set up error handler that logs errors', () => {
      expect(capturedErrorHandler).not.toBeNull();

      const testError = new Error('Connection dropped');
      capturedErrorHandler!(testError);

      expect(logger.error).toHaveBeenCalledWith('Redis Client Error', { error: 'Connection dropped' });
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

      let readyCallback: (() => void) | null = null;
      mockOnce.mockImplementation((event: string, callback: () => void) => {
        if (event === 'ready') {
          readyCallback = callback;
          setTimeout(() => callback(), 10);
        }
        return { once: mockOnce };
      });

      await redisCache.connect();

      expect(logger.info).toHaveBeenCalledWith('Redis Connected');
    });

    it('should reject on connection error during connect', async () => {
      mockStatus = 'connecting';

      mockOnce.mockImplementation((event: string, callback: (err?: Error) => void) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Connection refused')), 10);
        }
        return { once: mockOnce };
      });

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
