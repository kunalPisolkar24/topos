import { IUserService, PaginationArgs, UserResponse } from './interfaces/user.service.interface';
import { SignupInput, SigninInput, UpdateProfileInput } from '../types';
import { CacheAside } from '../lib/cacheAside';

export class CachedUserService implements IUserService {
    private readonly cacheAside: CacheAside<number, UserResponse>;

    constructor(
        private readonly service: IUserService,
        cache: import('keyv').default
    ) {
        this.cacheAside = new CacheAside<number, UserResponse>(cache, {
            userTtlMs: 3_600_000,
            missingUserTtlMs: 60_000,
            keyPrefix: 'user:v1',
        });
    }

    async signup(data: SignupInput) {
        const authResponse = await this.service.signup(data);
        await this.cacheAside.warm(authResponse.user.id, authResponse.user);
        return authResponse;
    }

    async signin(data: SigninInput) {
        const authResponse = await this.service.signin(data);
        await this.cacheAside.warm(authResponse.user.id, authResponse.user);
        return authResponse;
    }

    findById(id: number) {
        return this.cacheAside.getOrLoad(id, (userId) => this.service.findById(userId));
    }

    findByIds(ids: readonly number[]) {
        return this.cacheAside.getOrLoadMany(ids, (missing) => this.service.findByIds(missing));
    }

    async findAll(args: PaginationArgs) {
        return this.service.findAll(args);
    }

    async updateProfile(userId: number, data: UpdateProfileInput) {
        const updatedUser = await this.service.updateProfile(userId, data);
        const cached = await this.cacheAside.warm(userId, updatedUser);
        if (!cached) {
            await this.cacheAside.invalidate(userId);
        }
        return updatedUser;
    }
}
