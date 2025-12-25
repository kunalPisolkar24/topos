import { Redis } from 'ioredis';
import { config } from '../../config/index.js';
import { ICacheService } from '../../core/interfaces/cache.interface.js';
import { ILogger } from '../../core/interfaces/logger.interface.js';

export class RedisCache implements ICacheService {
  private client: Redis;

  constructor(private readonly logger: ILogger) {
    this.client = new Redis({
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      lazyConnect: true,
      retryStrategy: (times: number) => {
        return Math.min(times * 50, 2000);
      },
    });

    this.client.on('error', (err: Error) => {
      this.logger.error('Redis Client Error', { error: err.message });
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.logger.info('Redis Connected');
    } catch (error: any) {
      this.logger.error('Failed to connect to Redis', { error: error.message });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
    this.logger.info('Redis Disconnected');
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }
}