import Keyv from 'keyv';
import { metrics } from './metrics';
import { logger } from './logger';

const NEGATIVE_CACHE_MARKER = 1;

export interface CacheAsideOptions {
    userTtlMs: number;
    missingUserTtlMs: number;
    keyPrefix: string;
}

export class CacheAside<TKey, TValue> {
    private readonly inflight = new Map<string, Promise<TValue | null>>();

    constructor(
        private readonly cache: Keyv,
        private readonly options: CacheAsideOptions
    ) {}

    async getOrLoad(
        id: TKey,
        loader: (id: TKey) => Promise<TValue | null>
    ): Promise<TValue | null> {
        const key = String(id);

        const cached = await this.read(id);
        if (cached !== undefined) {
            return cached;
        }

        if (await this.readMissing(id)) {
            return null;
        }

        const existing = this.inflight.get(key);
        if (existing) {
            return existing;
        }

        const promise = this.load(id, loader).finally(() => {
            this.inflight.delete(key);
        });
        this.inflight.set(key, promise);
        return promise;
    }

    async getOrLoadMany(
        ids: readonly TKey[],
        batchLoader: (ids: TKey[]) => Promise<(TValue | null)[]>
    ): Promise<(TValue | null)[]> {
        if (ids.length === 0) {
            return [];
        }

        const cached = await this.readMany(ids);
        const missingFlags = await this.readManyMissing(ids);

        const toFetch: TKey[] = [];
        cached.forEach((cachedValue, index) => {
            if (cachedValue === undefined && !missingFlags[index]) {
                toFetch.push(ids[index]);
            }
        });

        if (toFetch.length === 0) {
            return ids.map((_, index) => cached[index] ?? null);
        }

        const fetched = await batchLoader(toFetch);
        const fetchedByKey = new Map<TKey, TValue>();
        const writes: Promise<unknown>[] = [];

        fetched.forEach((value, index) => {
            const key = toFetch[index];
            if (!value) {
                writes.push(this.writeMissing(key));
                return;
            }
            fetchedByKey.set(key, value);
            writes.push(this.write(key, value));
        });

        await Promise.all(writes);

        return ids.map((id, index) => {
            if (cached[index] !== undefined) {
                return cached[index];
            }
            return fetchedByKey.get(id) ?? null;
        });
    }

    async invalidate(id: TKey): Promise<void> {
        const key = this.userKey(id);
        try {
            await this.cache.delete(key);
            metrics.cacheOperations.inc({ type: 'delete', status: 'success' });
        } catch (error) {
            metrics.cacheOperations.inc({ type: 'delete', status: 'error' });
            this.logCacheError('delete', key, error);
        }
    }

    async warm(id: TKey, value: TValue): Promise<boolean> {
        return this.write(id, value);
    }

    private async load(
        id: TKey,
        loader: (id: TKey) => Promise<TValue | null>
    ): Promise<TValue | null> {
        const value = await loader(id);
        if (value) {
            await this.write(id, value);
            return value;
        }
        await this.writeMissing(id);
        return null;
    }

    private async read(id: TKey): Promise<TValue | undefined> {
        const key = this.userKey(id);
        try {
            const cached = (await this.cache.get(key)) as TValue | null | undefined;
            if (cached !== undefined && cached !== null) {
                metrics.cacheOperations.inc({ type: 'read', status: 'hit' });
                return cached;
            }
            metrics.cacheOperations.inc({ type: 'read', status: 'miss' });
        } catch (error) {
            metrics.cacheOperations.inc({ type: 'read', status: 'error' });
            this.logCacheError('read', key, error);
        }
        return undefined;
    }

    private async readMissing(id: TKey): Promise<boolean> {
        const key = this.missingKey(id);
        try {
            const cached = (await this.cache.get(key)) as number | null | undefined;
            const hit = cached === NEGATIVE_CACHE_MARKER;
            metrics.cacheOperations.inc({ type: 'read', status: hit ? 'hit' : 'miss' });
            return hit;
        } catch (error) {
            metrics.cacheOperations.inc({ type: 'read', status: 'error' });
            this.logCacheError('read', key, error);
            return false;
        }
    }

    private async readMany(ids: readonly TKey[]): Promise<(TValue | undefined)[]> {
        const keys = ids.map((id) => this.userKey(id));
        if (typeof this.cache.getMany === 'function') {
            try {
                const values = (await this.cache.getMany(keys)) as Array<TValue | null | undefined>;
                values.forEach((value) => {
                    metrics.cacheOperations.inc({
                        type: 'read',
                        status: value !== undefined && value !== null ? 'hit' : 'miss',
                    });
                });
                return values.map((value) =>
                    value !== undefined && value !== null ? value : undefined
                );
            } catch (error) {
                metrics.cacheOperations.inc({ type: 'read', status: 'error' });
                this.logCacheError('read', keys.join(','), error);
                return ids.map(() => undefined);
            }
        }
        return Promise.all(ids.map((id) => this.read(id)));
    }

    private async readManyMissing(ids: readonly TKey[]): Promise<boolean[]> {
        const keys = ids.map((id) => this.missingKey(id));
        if (typeof this.cache.getMany === 'function') {
            try {
                const values = (await this.cache.getMany(keys)) as Array<number | null | undefined>;
                return values.map((value) => {
                    const hit = value === NEGATIVE_CACHE_MARKER;
                    metrics.cacheOperations.inc({ type: 'read', status: hit ? 'hit' : 'miss' });
                    return hit;
                });
            } catch (error) {
                metrics.cacheOperations.inc({ type: 'read', status: 'error' });
                this.logCacheError('read', keys.join(','), error);
                return ids.map(() => false);
            }
        }
        return Promise.all(ids.map((id) => this.readMissing(id)));
    }

    private async write(id: TKey, value: TValue): Promise<boolean> {
        const key = this.userKey(id);
        try {
            await this.cache.set(key, value, this.options.userTtlMs);
            metrics.cacheOperations.inc({ type: 'write', status: 'success' });
            return true;
        } catch (error) {
            metrics.cacheOperations.inc({ type: 'write', status: 'error' });
            this.logCacheError('write', key, error);
            return false;
        }
    }

    private async writeMissing(id: TKey): Promise<void> {
        const key = this.missingKey(id);
        try {
            await this.cache.set(key, NEGATIVE_CACHE_MARKER, this.options.missingUserTtlMs);
            metrics.cacheOperations.inc({ type: 'write', status: 'success' });
        } catch (error) {
            metrics.cacheOperations.inc({ type: 'write', status: 'error' });
            this.logCacheError('write', key, error);
        }
    }

    private userKey(id: TKey): string {
        return `${this.options.keyPrefix}:${String(id)}`;
    }

    private missingKey(id: TKey): string {
        return `${this.options.keyPrefix}:missing:${String(id)}`;
    }

    private logCacheError(operation: 'read' | 'write' | 'delete', key: string, error: unknown): void {
        logger.error({
            msg: 'Cache operation failed',
            operation,
            key,
            error,
        });
    }
}
