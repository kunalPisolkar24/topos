import Keyv from 'keyv';
import { IUserService, PaginationArgs, UserResponse } from './interfaces/user.service.interface';
import { SignupInput, SigninInput, UpdateProfileInput } from '../types';
import { metrics } from '../lib/metrics';

export class CachedUserService implements IUserService {
    private readonly ttlMs = 3600000;

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
        if (cachedUser) {
            return cachedUser;
        }

        const user = await this.service.findById(id);
        if (user) {
            await this.writeUserToCache(user);
        }

        return user;
    }

    async findByIds(ids: readonly number[]) {
        const cachedUsers = await Promise.all(ids.map((id) => this.readUserFromCache(id)));

        const missingIds: number[] = [];
        cachedUsers.forEach((cachedUser, index) => {
            if (!cachedUser) {
                missingIds.push(ids[index]);
            }
        });

        if (missingIds.length === 0) {
            return cachedUsers.map((cachedUser) => cachedUser ?? null);
        }

        const fetchedUsers = await this.service.findByIds(missingIds);
        const fetchedById = new Map<number, UserResponse>();

        fetchedUsers.forEach((user, index) => {
            if (!user) {
                return;
            }

            const userId = missingIds[index];
            fetchedById.set(userId, user);
        });

        await Promise.all(Array.from(fetchedById.values()).map((user) => this.writeUserToCache(user)));

        return ids.map((id, index) => cachedUsers[index] ?? fetchedById.get(id) ?? null);
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
        }

        return undefined;
    }

    private async writeUserToCache(user: UserResponse, invalidateOnError = false): Promise<void> {
        const key = this.userKey(user.id);

        try {
            await this.cache.set(key, user, this.ttlMs);
            metrics.cacheOperations.inc({ type: 'write', status: 'success' });
        } catch (error) {
            metrics.cacheOperations.inc({ type: 'write', status: 'error' });

            if (invalidateOnError) {
                await this.invalidateUserCache(user.id);
            }
        }
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
