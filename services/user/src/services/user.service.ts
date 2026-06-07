import { PrismaClient, User } from '../generated/prisma/client';
import { PasswordHasher, passwordHasher } from '../utils/passwordHasher';
import { TokenService, tokenService } from '../utils/tokenService';
import { SignupInput, SigninInput, UpdateProfileInput } from '../types';
import { IUserService, PaginationArgs } from './interfaces/user.service.interface';
import { metrics } from '../lib/metrics';
import {
    InvalidCredentialsError,
    UserAlreadyExistsError,
    UserNotFoundError,
} from '../errors/DomainError';
import { toDomainError } from '../errors/prismaError';
import { toUserResponse } from './user.mapper';

export class UserService implements IUserService {
    constructor(
        private readonly prisma: PrismaClient,
        private readonly hasher: PasswordHasher = passwordHasher,
        private readonly tokens: TokenService = tokenService
    ) {}

    private async measureDb<T>(operation: string, fn: () => Promise<T>): Promise<T> {
        const stopTimer = metrics.dbOperations.startTimer({ operation, model: 'User' });
        try {
            const result = await fn();
            stopTimer();
            return result;
        } catch (error) {
            stopTimer();
            throw error;
        }
    }

    async signup(data: SignupInput) {
        const hashedPassword = await this.hasher.hash(data.password);

        let user: User;
        try {
            user = await this.measureDb('create', () =>
                this.prisma.user.create({
                    data: {
                        email: data.email,
                        username: data.username,
                        password: hashedPassword,
                        name: data.username,
                    },
                })
            );
        } catch (error) {
            throw toDomainError(error);
        }

        const token = this.tokens.sign({ id: user.id });

        return {
            user: toUserResponse(user),
            token,
        };
    }

    async signin(data: SigninInput) {
        const user = await this.measureDb('findUnique', () =>
            this.prisma.user.findUnique({
                where: { email: data.email },
            })
        );

        const storedHash = user?.password ?? (await this.hasher.getDummyHash());
        const valid = await this.hasher.verify(data.password, storedHash);

        if (!user || !valid) {
            throw new InvalidCredentialsError();
        }

        const token = this.tokens.sign({ id: user.id });

        return {
            user: toUserResponse(user),
            token,
        };
    }

    async findById(id: number) {
        const user = await this.measureDb('findUnique', () =>
            this.prisma.user.findUnique({
                where: { id },
            })
        );

        if (!user) return null;

        return toUserResponse(user);
    }

    async findByIds(ids: readonly number[]) {
        if (ids.length === 0) {
            return [];
        }

        const users = await this.measureDb('findMany', () =>
            this.prisma.user.findMany({
                where: { id: { in: [...ids] } },
            })
        );

        const userMap = new Map(users.map((user) => [user.id, user]));

        return ids.map((id) => {
            const user = userMap.get(id);
            return user ? toUserResponse(user) : null;
        });
    }

    async findAll({ limit, cursor }: PaginationArgs) {
        const users = await this.measureDb('findMany', () =>
            this.prisma.user.findMany({
                take: limit,
                skip: cursor ? 1 : 0,
                cursor: cursor ? { id: cursor } : undefined,
                orderBy: { id: 'desc' },
            })
        );

        return users.map((user) => toUserResponse(user));
    }

    async updateProfile(userId: number, data: UpdateProfileInput) {
        let updatedUser: User;
        try {
            updatedUser = await this.measureDb('update', () =>
                this.prisma.user.update({
                    where: { id: userId },
                    data: {
                        name: data.name,
                        bio: data.bio,
                        avatarUrl: data.avatarUrl,
                        bannerUrl: data.bannerUrl,
                    },
                })
            );
        } catch (error) {
            throw toDomainError(error);
        }

        return toUserResponse(updatedUser);
    }
}

export { UserAlreadyExistsError, UserNotFoundError, InvalidCredentialsError };
