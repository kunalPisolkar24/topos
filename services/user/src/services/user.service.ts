import { PrismaClient } from '../generated/prisma/client';
import { PasswordUtils } from '../utils/password';
import { JwtUtils } from '../utils/jwt';
import { SignupInput, SigninInput, UpdateProfileInput } from '../types';
import { logger } from '../lib/logger';
import { serviceCache } from '../lib/cache';

export class UserService {
    constructor(private readonly prisma: PrismaClient) { }

    async signup(data: SignupInput) {
        logger.debug({ msg: 'Attempting signup', email: data.email });

        const existingUser = await this.prisma.user.findFirst({
            where: {
                OR: [{ email: data.email }, { username: data.username }],
            },
        });

        if (existingUser) {
            logger.warn({ msg: 'Signup failed: User exists', email: data.email });
            throw new Error('User already exists');
        }

        const hashedPassword = await PasswordUtils.hash(data.password);

        const user = await this.prisma.user.create({
            data: {
                email: data.email,
                username: data.username,
                password: hashedPassword,
                name: data.username,
            },
        });

        const token = JwtUtils.sign({ id: user.id });

        logger.info({ msg: 'User signed up successfully', userId: user.id });

        return {
            user: {
                ...user,
                createdAt: user.createdAt.toISOString(),
            },
            token,
        };
    }

    async signin(data: SigninInput) {
        logger.debug({ msg: 'Attempting signin', email: data.email });

        const user = await this.prisma.user.findUnique({
            where: { email: data.email },
        });

        if (!user) {
            logger.warn({ msg: 'Signin failed: User not found', email: data.email });
            throw new Error('Invalid credentials');
        }

        const isValid = await PasswordUtils.compare(data.password, user.password);
        if (!isValid) {
            logger.warn({ msg: 'Signin failed: Invalid password', userId: user.id });
            throw new Error('Invalid credentials');
        }

        const token = JwtUtils.sign({ id: user.id });

        logger.info({ msg: 'User signed in successfully', userId: user.id });

        return {
            user: {
                ...user,
                createdAt: user.createdAt.toISOString(),
            },
            token,
        };
    }

    async findById(id: number) {
        const cacheKey = `user:${id}`;

        if (serviceCache) {
            const cached = await serviceCache.get(cacheKey);
            if (cached) {
                logger.debug({ msg: 'Cache Hit', key: cacheKey });
                return cached;
            }
        }

        const user = await this.prisma.user.findUnique({
            where: { id },
        });

        if (!user) {
            logger.debug({ msg: 'User not found by ID', userId: id });
            return null;
        }

        const result = {
            ...user,
            createdAt: user.createdAt.toISOString(),
        };

        if (serviceCache) {
            await serviceCache.set(cacheKey, result, 3600000);
        }

        return result;
    }

    async getMe(id: number) {
        return this.findById(id);
    }

    async findAll() {
        const users = await this.prisma.user.findMany({
            orderBy: { createdAt: 'desc' }
        });

        return users.map(user => ({
            ...user,
            createdAt: user.createdAt.toISOString()
        }));
    }

    async updateProfile(userId: number, data: UpdateProfileInput) {
        logger.debug({ msg: 'Attempting profile update', userId });

        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            logger.warn({ msg: 'Update failed: User not found', userId });
            throw new Error('User not found');
        }

        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: {
                name: data.name,
                bio: data.bio,
                avatarUrl: data.avatarUrl,
                bannerUrl: data.bannerUrl,
            },
        });

        if (serviceCache) {
            const cacheKey = `user:${userId}`;
            await serviceCache.delete(cacheKey);
            logger.debug({ msg: 'Cache invalidated', key: cacheKey });
        }

        logger.info({ msg: 'Profile updated successfully', userId });

        return {
            ...updatedUser,
            createdAt: updatedUser.createdAt.toISOString(),
        };
    }
}