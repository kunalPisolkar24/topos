import Keyv from 'keyv';
import { IUserService, PaginationArgs } from './interfaces/user.service.interface';
import { SignupInput, SigninInput, UpdateProfileInput } from '../types';
import { logger } from '../lib/logger';

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
        const cached = await this.cache.get(key);
        
        if (cached) {
            return cached;
        }

        const user = await this.service.findById(id);
        
        if (user) {
            await this.cache.set(key, user, this.TTL);
        }

        return user;
    }

    async findByIds(ids: readonly number[]) {
        const keys = ids.map(id => `user:${id}`);
        const results = await Promise.all(ids.map(id => this.findById(id)));
        return results;
    }

    async findAll(args: PaginationArgs) {
        return this.service.findAll(args);
    }

    async updateProfile(userId: number, data: UpdateProfileInput) {
        const updatedUser = await this.service.updateProfile(userId, data);
        const key = `user:${userId}`;
        await this.cache.delete(key);
        return updatedUser;
    }
}