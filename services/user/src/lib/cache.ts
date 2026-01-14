import Keyv from 'keyv';
import KeyvRedis from '@keyv/redis';
import Redis from 'ioredis';
import { KeyvAdapter } from '@apollo/utils.keyvadapter';
import { env } from '../config/env';
import { logger } from './logger';

export class CacheFactory {
    static createCache() {
        if (env.REDIS_SENTINELS) {
            logger.info('Initializing Redis in Sentinel Mode');
            
            const sentinels = env.REDIS_SENTINELS.split(',').map(s => {
                const [host, port] = s.split(':');
                return { host, port: parseInt(port) };
            });

            const redisClient = new Redis({
                sentinels,
                name: env.REDIS_MASTER_NAME,
                password: env.REDIS_PASSWORD,
                retryStrategy: (times) => Math.min(times * 50, 2000),
            });

            redisClient.on('error', (err) => {
                logger.error({ msg: 'Redis Client Error', err });
            });

            return new KeyvAdapter(new Keyv({ store: new KeyvRedis(redisClient as any) }));
        }

        if (env.REDIS_URL) {
            logger.info('Initializing Redis in Standard Mode');
            return new KeyvAdapter(new Keyv({ store: new KeyvRedis(env.REDIS_URL) }));
        }

        logger.warn('No Redis configuration found. Using In-Memory cache');
        return undefined;
    }
}