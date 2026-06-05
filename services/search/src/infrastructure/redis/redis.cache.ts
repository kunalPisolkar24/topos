import { Redis, RedisOptions } from 'ioredis';
import { ICacheService } from '../../core/interfaces/cache.interface.js';
import { ILogger } from '../../core/interfaces/logger.interface.js';
import type { IConfig } from '../../core/interfaces/config.interface.js';

export type RedisConfig = IConfig['redis'];

export class RedisCache implements ICacheService {
    private readonly client: Redis;

    constructor(redisConfig: RedisConfig, private readonly logger: ILogger) {
        if (redisConfig.sentinelHosts && redisConfig.sentinelHosts.length > 0) {
            this.client = this.createSentinelClient(redisConfig);
        } else if (redisConfig.url) {
            this.client = this.createStandaloneClient(redisConfig);
        } else {
            throw new Error('RedisCache requires either redisConfig.url or redisConfig.sentinelHosts');
        }

        this.client.on('error', (err: Error) => {
            this.logger.error('Redis Client Error', { error: err.message });
        });
    }

    private createSentinelClient(config: RedisConfig): Redis {
        return new Redis({
            sentinels: config.sentinelHosts,
            name: config.sentinelMasterName,
            password: config.password,
            sentinelPassword: config.sentinelPassword,
            ...(config.sentinelTls
                ? {
                      sentinels: config.sentinelHosts!.map((s) => ({
                          host: s.host,
                          port: s.port,
                          tls: true,
                      })),
                  }
                : {}),
            retryStrategy: (times: number) => Math.min(times * 50, 2000),
            enableOfflineQueue: false,
        } as RedisOptions);
    }

    private createStandaloneClient(config: RedisConfig): Redis {
        return new Redis(config.url!, {
            password: config.password,
            retryStrategy: (times: number) => Math.min(times * 50, 2000),
            enableOfflineQueue: false,
        });
    }

    async connect(): Promise<void> {
        if (this.client.status === 'ready') {
            return;
        }
        if (this.client.status === 'wait' || this.client.status === 'connecting') {
            try {
                await this.client.ping();
                this.logger.info('Redis Connected');
            } catch (err: any) {
                this.logger.error('Redis ping failed', { error: err.message });
                throw err;
            }
            return;
        }
        try {
            await this.client.connect();
        } catch (err: any) {
            if (err.message && err.message.includes('already connecting')) {
                try {
                    await this.client.ping();
                    this.logger.info('Redis Connected');
                    return;
                } catch (pingErr: any) {
                    this.logger.error('Redis ping failed', { error: pingErr.message });
                    throw pingErr;
                }
            }
            this.logger.error('Redis connect failed', { error: err.message });
            throw err;
        }
        try {
            await this.client.ping();
        } catch (err: any) {
            this.logger.error('Redis ping failed', { error: err.message });
            throw err;
        }
        this.logger.info('Redis Connected');
    }

    async disconnect(): Promise<void> {
        try {
            await this.client.quit();
            this.logger.info('Redis Disconnected');
        } catch (err: any) {
            this.logger.error('Redis Disconnect Error', { error: err.message });
        }
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

    async delete(key: string): Promise<void> {
        await this.client.del(key);
    }
}
