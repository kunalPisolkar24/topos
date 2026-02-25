import Keyv from 'keyv';
import KeyvRedis, { createSentinel } from '@keyv/redis';
import { KeyvAdapter } from '@apollo/utils.keyvadapter';
import { env } from '../config/env';
import { logger } from './logger';

export let serviceCache: Keyv;
const CACHE_NAMESPACE = 'user-service';

export class CacheFactory {
    static createCache() {
        try {
            if (env.REDIS_SENTINELS) {
                serviceCache = this.createSentinelCache(env.REDIS_SENTINELS);
                return new KeyvAdapter(serviceCache);
            }

            if (env.REDIS_URL) {
                serviceCache = this.createUrlCache(env.REDIS_URL);
                return new KeyvAdapter(serviceCache);
            }
        } catch (error) {
            logger.error({
                msg: 'Failed to initialize Redis cache backend, falling back to in-memory cache',
                error,
            });
        }

        serviceCache = new Keyv();
        return undefined;
    }

    private static createSentinelCache(rawSentinels: string): Keyv {
        const sentinelRootNodes = rawSentinels
            .split(',')
            .map(address => address.trim())
            .filter(Boolean)
            .map(address => {
                const [host, portText] = address.split(':');
                const port = Number.parseInt(portText, 10);

                if (!host || Number.isNaN(port)) {
                    throw new Error(`Invalid Redis sentinel node: ${address}`);
                }

                return { host, port };
            });

        const sentinel = createSentinel({
            name: env.REDIS_MASTER_NAME,
            sentinelRootNodes,
            nodeClientOptions: env.REDIS_PASSWORD ? { password: env.REDIS_PASSWORD } : undefined,
            sentinelClientOptions: env.REDIS_PASSWORD ? { password: env.REDIS_PASSWORD } : undefined,
        });

        const store = new KeyvRedis(sentinel, { namespace: CACHE_NAMESPACE });
        store.on('error', (err) => {
            logger.error({ msg: 'Redis Cache Error', err });
        });

        return new Keyv({
            store,
            namespace: CACHE_NAMESPACE,
            useKeyPrefix: false,
        });
    }

    private static createUrlCache(redisUrl: string): Keyv {
        const store = new KeyvRedis(redisUrl, { namespace: CACHE_NAMESPACE });
        store.on('error', (err) => {
            logger.error({ msg: 'Redis Cache Error', err });
        });

        return new Keyv({
            store,
            namespace: CACHE_NAMESPACE,
            useKeyPrefix: false,
        });
    }

    static async disconnect() {
        if (serviceCache) {
            await serviceCache.disconnect();
        }
    }
}
