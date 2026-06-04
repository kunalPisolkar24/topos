import Keyv from 'keyv';
import KeyvRedis, { createSentinel } from '@keyv/redis';
import { KeyvAdapter } from '@apollo/utils.keyvadapter';
import { env } from '../config/env';
import { logger } from './logger';

const CACHE_NAMESPACE = 'user-service';

export class CacheFactory {
    static createServiceCache(): Keyv {
        try {
            if (env.REDIS_SENTINELS) {
                return this.createSentinelCache();
            }
            if (env.REDIS_URL) {
                return this.createUrlCache(env.REDIS_URL);
            }
        } catch (error) {
            logger.error({
                msg: 'Failed to initialize Redis cache backend, falling back to in-memory cache',
                error,
            });
        }
        return this.createInMemoryCache();
    }

    static createApolloCache(serviceCache: Keyv): KeyvAdapter | undefined {
        const store = (serviceCache as unknown as { store?: { opts?: { uri?: string } } }).store;
        const uri = store?.opts?.uri;
        if (!uri) {
            return undefined;
        }
        return new KeyvAdapter(serviceCache);
    }

    static async disconnect(cache: Keyv | undefined): Promise<void> {
        if (!cache) {
            return;
        }
        if (typeof cache.disconnect === 'function') {
            await cache.disconnect();
        }
    }

    private static createInMemoryCache(): Keyv {
        return new Keyv();
    }

    private static createSentinelCache(): Keyv {
        const sentinelRootNodes = (env.REDIS_SENTINELS ?? '')
            .split(',')
            .map((address) => address.trim())
            .filter(Boolean)
            .map((address) => {
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
}
