import Keyv from 'keyv';
import KeyvRedis, { createSentinel } from '@keyv/redis';
import { env } from '../config/env';
import { logger } from './logger';

const CACHE_NAMESPACE = 'user-service';

export interface CacheBackend {
    readonly id: string;
    readonly supportsApollo: boolean;
    create(): Keyv;
    disconnect(cache: Keyv): Promise<void>;
}

class InMemoryCacheBackend implements CacheBackend {
    readonly id = 'memory';
    readonly supportsApollo = false;

    create(): Keyv {
        return new Keyv();
    }

    async disconnect(cache: Keyv): Promise<void> {
        if (cache && typeof cache.disconnect === 'function') {
            await cache.disconnect();
        }
    }
}

class RedisCacheBackend implements CacheBackend {
    readonly id = 'redis';
    readonly supportsApollo = true;

    constructor(private readonly url: string) {}

    create(): Keyv {
        const store = new KeyvRedis(this.url, { namespace: CACHE_NAMESPACE });
        store.on('error', (err) => {
            logger.error({ msg: 'Redis Cache Error', err });
        });
        return new Keyv({
            store,
            namespace: CACHE_NAMESPACE,
            useKeyPrefix: false,
        });
    }

    async disconnect(cache: Keyv): Promise<void> {
        if (cache && typeof cache.disconnect === 'function') {
            await cache.disconnect();
        }
    }
}

class SentinelRedisCacheBackend implements CacheBackend {
    readonly id = 'sentinel';
    readonly supportsApollo = true;

    constructor(
        private readonly sentinels: string,
        private readonly masterName: string,
        private readonly password: string | undefined
    ) {}

    create(): Keyv {
        const sentinelRootNodes = this.sentinels
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
            name: this.masterName,
            sentinelRootNodes,
            nodeClientOptions: this.password ? { password: this.password } : undefined,
            sentinelClientOptions: this.password ? { password: this.password } : undefined,
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

    async disconnect(cache: Keyv): Promise<void> {
        if (cache && typeof cache.disconnect === 'function') {
            await cache.disconnect();
        }
    }
}

export const selectCacheBackend = (): CacheBackend => {
    try {
        if (env.REDIS_SENTINELS) {
            return new SentinelRedisCacheBackend(
                env.REDIS_SENTINELS,
                env.REDIS_MASTER_NAME,
                env.REDIS_PASSWORD
            );
        }
        if (env.REDIS_URL) {
            return new RedisCacheBackend(env.REDIS_URL);
        }
    } catch (error) {
        logger.error({
            msg: 'Failed to initialize Redis cache backend, falling back to in-memory cache',
            error,
        });
    }
    return new InMemoryCacheBackend();
};
