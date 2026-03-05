import Keyv from 'keyv';
import { IUserService, PaginationArgs, UserResponse } from './interfaces/user.service.interface';
import { SignupInput, SigninInput, UpdateProfileInput } from '../types';
import { metrics } from '../lib/metrics';

interface MissingUserCacheEntry {
    __cacheType: 'missing-user';
}

export class CachedUserService implements IUserService {
    private readonly ttlMs = 3600000;
    private readonly missingTtlMs = 60000;
    private readonly missingUserCacheEntry: MissingUserCacheEntry = { __cacheType: 'missing-user' };

    constructor(
        private readonly service: IUserService,
        private readonly cache: Keyv
    ) {}

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

        const user = await this.service.findById(id);
        if (user) {
            await this.writeUserToCache(user);
        } else {
            await this.writeMissingUserToCache(id);
        }

        return user;
    }

    async findByIds(ids: readonly number[]) {
        const cachedUsers = await Promise.all(ids.map((id) => this.readUserFromCache(id)));

        const missingIds: number[] = [];
        cachedUsers.forEach((cachedUser, index) => {
            if (cachedUser === undefined) {
                missingIds.push(ids[index]);
            }
        });

        if (missingIds.length === 0) {
            return cachedUsers.map((cachedUser) => cachedUser ?? null);
        }

        const fetchedUsers = await this.service.findByIds(missingIds);
        const fetchedById = new Map<number, UserResponse>();
        const cacheWrites: Promise<void>[] = [];

        fetchedUsers.forEach((user, index) => {
            const userId = missingIds[index];
            if (!user) {
                cacheWrites.push(this.writeMissingUserToCache(userId));
                return;
            }

            fetchedById.set(userId, user);
            cacheWrites.push(this.writeUserToCache(user));
        });

        await Promise.all(cacheWrites);

        return ids.map((id, index) => {
            const cachedUser = cachedUsers[index];
            if (cachedUser !== undefined) {
                return cachedUser;
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
        return `user:${id}`;
    }

    private async readUserFromCache(id: number): Promise<UserResponse | null | undefined> {
        const key = this.userKey(id);

        try {
            const cached = await this.cache.get<UserResponse | MissingUserCacheEntry>(key);
            if (cached !== undefined && cached !== null) {
                metrics.cacheOperations.inc({ type: 'read', status: 'hit' });

                if (this.isMissingUserCacheEntry(cached)) {
                    return null;
                }

                return cached;
            }

            metrics.cacheOperations.inc({ type: 'read', status: 'miss' });
        } catch (error) {
            metrics.cacheOperations.inc({ type: 'read', status: 'error' });
        }

        return undefined;
    }

    private isMissingUserCacheEntry(value: unknown): value is MissingUserCacheEntry {
        return (
            typeof value === 'object' &&
            value !== null &&
            '__cacheType' in value &&
            (value as MissingUserCacheEntry).__cacheType === 'missing-user'
        );
    }

    private async writeUserToCache(user: UserResponse, invalidateOnError = false): Promise<void> {
        const key = this.userKey(user.id);
        const cacheableUser = this.toCacheableUser(user);

        try {
            await this.cache.set(key, cacheableUser, this.ttlMs);
            metrics.cacheOperations.inc({ type: 'write', status: 'success' });
        } catch (error) {
            metrics.cacheOperations.inc({ type: 'write', status: 'error' });

            if (invalidateOnError) {
                await this.invalidateUserCache(user.id);
            }
        }
    }

    private async writeMissingUserToCache(userId: number): Promise<void> {
        const key = this.userKey(userId);

        try {
            await this.cache.set(key, this.missingUserCacheEntry, this.missingTtlMs);
            metrics.cacheOperations.inc({ type: 'write', status: 'success' });
        } catch (error) {
            metrics.cacheOperations.inc({ type: 'write', status: 'error' });
        }
    }

    private toCacheableUser(user: UserResponse): UserResponse {
        return {
            id: user.id,
            username: user.username,
            email: user.email,
            name: user.name,
            bio: user.bio,
            avatarUrl: user.avatarUrl,
            bannerUrl: user.bannerUrl,
            createdAt: user.createdAt,
        };
    }

    private async invalidateUserCache(userId: number): Promise<void> {
        const key = this.userKey(userId);

        try {
            await this.cache.delete(key);
            metrics.cacheOperations.inc({ type: 'delete', status: 'success' });
        } catch (error) {
            metrics.cacheOperations.inc({ type: 'delete', status: 'error' });
        }
    }
}
