import { Redis, RedisOptions } from 'ioredis';
import { getSharedConfig } from '../../config/index.js';
import { ICacheService } from '../../core/interfaces/cache.interface.js';
import { ILogger } from '../../core/interfaces/logger.interface.js';

export class RedisCache implements ICacheService {
  private client: Redis;
  private readonly config = getSharedConfig();

  constructor(private readonly logger: ILogger) {
    const sentinels = this.config.REDIS_SENTINEL_HOSTS.split(',').map(pair => {
      const [host, port] = pair.split(':');
      return { host, port: parseInt(port, 10) };
    });

    const redisConfig: RedisOptions = {
      sentinels: sentinels,
      name: this.config.REDIS_MASTER_NAME,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      enableOfflineQueue: false,
    };

    this.client = new Redis(redisConfig);

    this.client.on('error', (err: Error) => {
      this.logger.error('Redis Client Error', { error: err.message });
    });
  }

  async connect(): Promise<void> {
    if (this.client.status === 'ready') return;
    await new Promise<void>((resolve, reject) => {
        this.client.once('ready', () => resolve());
        this.client.once('error', (e) => reject(e));
    });
    this.logger.info('Redis Connected');
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
