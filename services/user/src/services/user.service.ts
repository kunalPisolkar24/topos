import { PrismaClient, User } from '../generated/prisma/client';
import { PasswordUtils } from '../utils/password';
import { JwtUtils } from '../utils/jwt';
import { SignupInput, SigninInput, UpdateProfileInput } from '../types';
import { IUserService, PaginationArgs, UserResponse } from './interfaces/user.service.interface';
import { metrics } from '../lib/metrics';

export class UserService implements IUserService {
    constructor(private readonly prisma: PrismaClient) { }

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
        const existingUser = await this.measureDb('findFirst', () => 
            this.prisma.user.findFirst({
                where: {
                    OR: [{ email: data.email }, { username: data.username }],
                },
            })
        );

        if (existingUser) {
            throw new Error('User already exists');
        }

        const hashedPassword = await PasswordUtils.hash(data.password);

        const user = await this.measureDb('create', () => 
            this.prisma.user.create({
                data: {
                    email: data.email,
                    username: data.username,
                    password: hashedPassword,
                    name: data.username,
                },
            })
        );

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

        if (!user) {
            throw new Error('Invalid credentials');
        }

        const isValid = await PasswordUtils.compare(data.password, user.password);
        if (!isValid) {
            throw new Error('Invalid credentials');
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
        const users = await this.measureDb('findMany', () => 
            this.prisma.user.findMany({
                where: { id: { in: [...ids] } }
            })
        );

        const userMap = new Map(users.map(user => [user.id, user]));

        return ids.map(id => {
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
                orderBy: { id: 'desc' }
            })
        );

        return users.map(user => this.toUserResponse(user));
    }

    async updateProfile(userId: number, data: UpdateProfileInput) {
        const user = await this.measureDb('findUnique', () => 
            this.prisma.user.findUnique({ where: { id: userId } })
        );
        
        if (!user) {
            throw new Error('User not found');
        }

        const updatedUser = await this.measureDb('update', () => 
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

        return this.toUserResponse(updatedUser);
    }
}
