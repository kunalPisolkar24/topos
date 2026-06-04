import Keyv from 'keyv';
import { IUserService, PaginationArgs, UserResponse } from './interfaces/user.service.interface';
import { SignupInput, SigninInput, UpdateProfileInput } from '../types';
import { metrics } from '../lib/metrics';
import { env } from '../config/env';
import { logger } from '../lib/logger';

const NEGATIVE_CACHE_MARKER = 1;

interface CachedUserServiceOptions {
    userTtlMs: number;
    missingUserTtlMs: number;
}

export class CachedUserService implements IUserService {
    private readonly ttlMs: number;
    private readonly missingTtlMs: number;

    constructor(
        private readonly service: IUserService,
        private readonly cache: Keyv,
        options: CachedUserServiceOptions = {
            userTtlMs: env.USER_CACHE_TTL_MS,
            missingUserTtlMs: env.USER_MISSING_CACHE_TTL_MS,
        }
    ) {
        this.ttlMs = options.userTtlMs;
        this.missingTtlMs = options.missingUserTtlMs;
    }

    async signup(data: SignupInput) {
        const authResponse = await this.service.signup(data);
        await this.writeUserToCache(authResponse.user);
        return authResponse;
    }

    async signin(data: SigninInput) {
        const authResponse = await this.service.signin(data);
        await this.writeUserToCache(authResponse.user);
        return authResponse;
    }

    async findById(id: number) {
        const cachedUser = await this.readUserFromCache(id);
        if (cachedUser !== undefined) {
            return cachedUser;
        }

        if (await this.readMissingFromCache(id)) {
            return null;
        }

        const user = await this.service.findById(id);
        if (user) {
            await this.writeUserToCache(user);
        } else {
            await this.writeMissingToCache(id);
        }

        return user;
    }

    async findByIds(ids: readonly number[]) {
        if (ids.length === 0) {
            return [];
        }

        const cached = await Promise.all(
            ids.map((id) => this.readUserFromCache(id))
        );
        const missingFlags = await Promise.all(
            ids.map((id) => this.readMissingFromCache(id))
        );

        const toFetch: number[] = [];
        cached.forEach((cachedUser, index) => {
            if (cachedUser === undefined && !missingFlags[index]) {
                toFetch.push(ids[index]);
            }
        });

        if (toFetch.length === 0) {
            return ids.map((id, index) => cached[index] ?? null);
        }

        const fetched = await this.service.findByIds(toFetch);
        const fetchedById = new Map<number, UserResponse>();
        const writes: Promise<void>[] = [];

        fetched.forEach((user, index) => {
            const id = toFetch[index];
            if (!user) {
                writes.push(this.writeMissingToCache(id));
                return;
            }
            fetchedById.set(id, user);
            writes.push(this.writeUserToCache(user));
        });

        await Promise.all(writes);

        return ids.map((id, index) => {
            if (cached[index] !== undefined) {
                return cached[index];
            }
            return fetchedById.get(id) ?? null;
        });
    }

    async findAll(args: PaginationArgs) {
        return this.service.findAll(args);
    }

    async updateProfile(userId: number, data: UpdateProfileInput) {
        const updatedUser = await this.service.updateProfile(userId, data);
        await this.writeUserToCache(updatedUser, true);
        return updatedUser;
    }

    private userKey(id: number): string {
        return `user:v1:${id}`;
    }

    private missingKey(id: number): string {
        return `user:v1:missing:${id}`;
    }

    private async readUserFromCache(id: number): Promise<UserResponse | undefined> {
        const key = this.userKey(id);
        try {
            const cached = await this.cache.get<UserResponse>(key);
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

    private async readMissingFromCache(id: number): Promise<boolean> {
        const key = this.missingKey(id);
        try {
            const cached = await this.cache.get<number>(key);
            const hit = cached === NEGATIVE_CACHE_MARKER;
            metrics.cacheOperations.inc({ type: 'read', status: hit ? 'hit' : 'miss' });
            return hit;
        } catch (error) {
            metrics.cacheOperations.inc({ type: 'read', status: 'error' });
            this.logCacheError('read', key, error);
            return false;
        }
    }

    private async writeUserToCache(user: UserResponse, invalidateOnError = false): Promise<void> {
        const key = this.userKey(user.id);
        try {
            await this.cache.set(key, user, this.ttlMs);
            metrics.cacheOperations.inc({ type: 'write', status: 'success' });
        } catch (error) {
            metrics.cacheOperations.inc({ type: 'write', status: 'error' });
            this.logCacheError('write', key, error);

            if (invalidateOnError) {
                await this.invalidateUserCache(user.id);
            }
        }
    }

    private async writeMissingToCache(userId: number): Promise<void> {
        const key = this.missingKey(userId);
        try {
            await this.cache.set(key, NEGATIVE_CACHE_MARKER, this.missingTtlMs);
            metrics.cacheOperations.inc({ type: 'write', status: 'success' });
        } catch (error) {
            metrics.cacheOperations.inc({ type: 'write', status: 'error' });
            this.logCacheError('write', key, error);
        }
    }

    private async invalidateUserCache(userId: number): Promise<void> {
        const key = this.userKey(userId);
        try {
            await this.cache.delete(key);
            metrics.cacheOperations.inc({ type: 'delete', status: 'success' });
        } catch (error) {
            metrics.cacheOperations.inc({ type: 'delete', status: 'error' });
            this.logCacheError('delete', key, error);
        }
    }

    private logCacheError(operation: 'read' | 'write' | 'delete', key: string, error: unknown): void {
        logger.error({
            msg: 'User cache operation failed',
            operation,
            key,
            error,
        });
    }
}
