import { PrismaClient, User } from '../generated/prisma/client';
import { PasswordHasher, passwordHasher } from '../utils/passwordHasher';
import { JwtUtils } from '../utils/jwt';
import { SignupInput, SigninInput, UpdateProfileInput } from '../types';
import { IUserService, PaginationArgs, UserResponse } from './interfaces/user.service.interface';
import { metrics } from '../lib/metrics';
import {
    InvalidCredentialsError,
    UserAlreadyExistsError,
    UserNotFoundError,
} from '../errors/DomainError';
import { toDomainError } from '../errors/prismaError';

export class UserService implements IUserService {
    constructor(
        private readonly prisma: PrismaClient,
        private readonly hasher: PasswordHasher = passwordHasher
    ) {}

    private toUserResponse(user: User): UserResponse {
        return {
            id: user.id,
            username: user.username,
            email: user.email,
            name: user.name,
            bio: user.bio,
            avatarUrl: user.avatarUrl,
            bannerUrl: user.bannerUrl,
            createdAt: user.createdAt.toISOString(),
        };
    }

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

        const token = JwtUtils.sign({ id: user.id });

        return {
            user: this.toUserResponse(user),
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

        const token = JwtUtils.sign({ id: user.id });

        return {
            user: this.toUserResponse(user),
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

        return this.toUserResponse(user);
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
            return user ? this.toUserResponse(user) : null;
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

        return users.map((user) => this.toUserResponse(user));
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

        return this.toUserResponse(updatedUser);
    }
}

export { UserAlreadyExistsError, UserNotFoundError, InvalidCredentialsError };
