import { PrismaClient } from '../generated/prisma/client';
import { PasswordUtils } from '../utils/password';
import { JwtUtils } from '../utils/jwt';
import { SignupInput, SigninInput, UpdateProfileInput } from '../types';
import { IUserService, PaginationArgs } from './interfaces/user.service.interface';
import { metrics } from '../lib/metrics';

export class UserService implements IUserService {
    constructor(private readonly prisma: PrismaClient) { }

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
            user: {
                ...user,
                createdAt: user.createdAt.toISOString(),
            },
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
            user: {
                ...user,
                createdAt: user.createdAt.toISOString(),
            },
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

        return {
            ...user,
            createdAt: user.createdAt.toISOString(),
        };
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
            return user ? { ...user, createdAt: user.createdAt.toISOString() } : null;
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

        return users.map(user => ({
            ...user,
            createdAt: user.createdAt.toISOString()
        }));
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

        return {
            ...updatedUser,
            createdAt: updatedUser.createdAt.toISOString(),
        };
    }
}