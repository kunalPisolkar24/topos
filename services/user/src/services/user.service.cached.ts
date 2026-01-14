import Keyv from 'keyv';
import { IUserService, PaginationArgs } from './interfaces/user.service.interface';
import { SignupInput, SigninInput, UpdateProfileInput } from '../types';
import { metrics } from '../lib/metrics';

export class CachedUserService implements IUserService {
    private readonly TTL = 3600000; 

    constructor(
        private readonly service: IUserService,
        private readonly cache: Keyv
    ) {}

    async signup(data: SignupInput) {
        return this.service.signup(data);
    }

    async signin(data: SigninInput) {
        return this.service.signin(data);
    }

    async findById(id: number) {
        const key = `user:${id}`;
        
        try {
            const cached = await this.cache.get(key);
            
            if (cached) {
                metrics.cacheOperations.inc({ type: 'read', status: 'hit' });
                return cached;
            }

            metrics.cacheOperations.inc({ type: 'read', status: 'miss' });
        } catch (error) {
            metrics.cacheOperations.inc({ type: 'read', status: 'error' });
        }

        const user = await this.service.findById(id);
        
        if (user) {
            try {
                await this.cache.set(key, user, this.TTL);
                metrics.cacheOperations.inc({ type: 'write', status: 'success' });
            } catch (error) {
                metrics.cacheOperations.inc({ type: 'write', status: 'error' });
            }
        }

        return user;
    }

    async findByIds(ids: readonly number[]) {
        const results = await Promise.all(ids.map(id => this.findById(id)));
        return results;
    }

    async findAll(args: PaginationArgs) {
        return this.service.findAll(args);
    }

    async updateProfile(userId: number, data: UpdateProfileInput) {
        const updatedUser = await this.service.updateProfile(userId, data);
        const key = `user:${userId}`;
        
        try {
            await this.cache.delete(key);
            metrics.cacheOperations.inc({ type: 'delete', status: 'success' });
        } catch (error) {
            metrics.cacheOperations.inc({ type: 'delete', status: 'error' });
        }
        
        return updatedUser;
    }
}