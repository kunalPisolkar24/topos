import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService } from '../../src/services/user.service';
import { prismaMock } from '../mocks/prisma';
import { PasswordUtils } from '../../src/utils/password';
import { faker } from '@faker-js/faker';
import { Prisma } from '../../src/generated/prisma/client';
import {
    InvalidCredentialsError,
    UserAlreadyExistsError,
    UserNotFoundError,
} from '../../src/errors/DomainError';

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
    return new Prisma.PrismaClientKnownRequestError('prisma error', {
        code,
        clientVersion: '7.4.1',
    });
}

function makeUser(overrides: Partial<{ id: number; email: string; username: string }> = {}) {
    return {
        id: overrides.id ?? 1,
        email: overrides.email ?? 'test@example.com',
        username: overrides.username ?? 'test_user',
        password: 'hashed',
        name: 'Test',
        bio: null,
        avatarUrl: null,
        bannerUrl: null,
        createdAt: new Date(),
    } as any;
}

describe('UserService Unit Tests', () => {
    let userService: UserService;

    beforeEach(() => {
        vi.clearAllMocks();
        userService = new UserService(prismaMock as any);
    });

    describe('signup', () => {
        it('should successfully create a new user', async () => {
            const signupInput = {
                email: faker.internet.email().toLowerCase(),
                username: faker.string.alphanumeric({ length: 10, casing: 'lower' }),
                password: faker.internet.password({ length: 14 }),
            };

            const hashedPassword = 'hashed_password_mock';
            const userId = faker.number.int();
            const now = new Date();

            vi.spyOn(PasswordUtils, 'hash').mockResolvedValue(hashedPassword);

            prismaMock.user.create.mockResolvedValue({
                id: userId,
                email: signupInput.email,
                username: signupInput.username,
                password: hashedPassword,
                name: signupInput.username,
                bio: null,
                avatarUrl: null,
                bannerUrl: null,
                createdAt: now,
            });

            const result = await userService.signup(signupInput);

            expect(prismaMock.user.create).toHaveBeenCalled();
            expect(result.token).toBeDefined();
            expect(result.user.email).toBe(signupInput.email);
        });

        it('should throw UserAlreadyExistsError when P2002 is returned', async () => {
            vi.spyOn(PasswordUtils, 'hash').mockResolvedValue('hashed_password_mock');
            prismaMock.user.create.mockRejectedValue(prismaError('P2002'));

            await expect(
                userService.signup({
                    email: 'a@b.com',
                    username: 'valid_user',
                    password: 'strong-password-123',
                })
            ).rejects.toBeInstanceOf(UserAlreadyExistsError);
        });

        it('should rethrow non-domain errors from prisma', async () => {
            vi.spyOn(PasswordUtils, 'hash').mockResolvedValue('hashed_password_mock');
            const unexpected = new Error('database down');
            prismaMock.user.create.mockRejectedValue(unexpected);

            await expect(
                userService.signup({
                    email: 'a@b.com',
                    username: 'valid_user',
                    password: 'strong-password-123',
                })
            ).rejects.toBe(unexpected);
        });
    });

    describe('signin', () => {
        it('should return token and user for valid credentials', async () => {
            const userMock = makeUser({ id: 1, email: 'test@test.com' });

            prismaMock.user.findUnique.mockResolvedValue(userMock);
            vi.spyOn(PasswordUtils, 'compare').mockResolvedValue(true);

            const result = await userService.signin({
                email: userMock.email,
                password: 'any-password-here',
            });

            expect(result.token).toBeDefined();
        });

        it('should throw InvalidCredentialsError for non-existent user', async () => {
            prismaMock.user.findUnique.mockResolvedValue(null);
            const compareSpy = vi.spyOn(PasswordUtils, 'compare').mockResolvedValue(false);

            await expect(
                userService.signin({
                    email: 'missing@test.com',
                    password: 'any-password-here',
                })
            ).rejects.toBeInstanceOf(InvalidCredentialsError);

            expect(compareSpy).toHaveBeenCalled();
        });

        it('should throw InvalidCredentialsError for invalid password', async () => {
            prismaMock.user.findUnique.mockResolvedValue({ password: 'hash' } as any);
            vi.spyOn(PasswordUtils, 'compare').mockResolvedValue(false);

            await expect(
                userService.signin({
                    email: 'test@test.com',
                    password: 'wrong-password-xx',
                })
            ).rejects.toBeInstanceOf(InvalidCredentialsError);
        });

        it('should throw InvalidCredentialsError when stored hash is malformed', async () => {
            prismaMock.user.findUnique.mockResolvedValue({ password: 'not-a-real-hash' } as any);
            vi.spyOn(PasswordUtils, 'compare').mockRejectedValue(new Error('invalid hash'));

            await expect(
                userService.signin({
                    email: 'test@test.com',
                    password: 'any-password-here',
                })
            ).rejects.toBeInstanceOf(InvalidCredentialsError);
        });
    });

    describe('findById', () => {
        it('should return user when found', async () => {
            const mockUser = { id: 1, createdAt: new Date() } as any;
            prismaMock.user.findUnique.mockResolvedValue(mockUser);

            const result = await userService.findById(1);
            expect(result).toBeDefined();
            expect(result?.id).toBe(1);
        });

        it('should return null when not found', async () => {
            prismaMock.user.findUnique.mockResolvedValue(null);
            const result = await userService.findById(999);
            expect(result).toBeNull();
        });
    });

    describe('findByIds', () => {
        it('returns an empty array for an empty id list', async () => {
            const result = await userService.findByIds([] as readonly number[]);
            expect(result).toEqual([]);
            expect(prismaMock.user.findMany).not.toHaveBeenCalled();
        });

        it('should return users mapped by id', async () => {
            const ids = [1, 2];
            const mockUsers = [
                { id: 1, createdAt: new Date() },
                { id: 2, createdAt: new Date() },
            ] as any[];

            prismaMock.user.findMany.mockResolvedValue(mockUsers);

            const result = await userService.findByIds(ids);
            expect(result).toHaveLength(2);
            expect(result[0]?.id).toBe(1);
            expect(result[1]?.id).toBe(2);
        });

        it('should handle missing users in batch', async () => {
            const ids = [1, 3];
            const mockUsers = [{ id: 1, createdAt: new Date() }] as any[];
            prismaMock.user.findMany.mockResolvedValue(mockUsers);

            const result = await userService.findByIds(ids);
            expect(result[0]?.id).toBe(1);
            expect(result[1]).toBeNull();
        });
    });

    describe('findAll', () => {
        it('should return list of users', async () => {
            const mockUsers = [{ id: 1, createdAt: new Date() }] as any[];
            prismaMock.user.findMany.mockResolvedValue(mockUsers);

            const result = await userService.findAll({ limit: 10 });
            expect(result).toHaveLength(1);
        });

        it('should handle pagination cursor', async () => {
            prismaMock.user.findMany.mockResolvedValue([]);
            await userService.findAll({ limit: 10, cursor: 5 });

            expect(prismaMock.user.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    skip: 1,
                    cursor: { id: 5 },
                })
            );
        });
    });

    describe('updateProfile', () => {
        it('should update user successfully', async () => {
            const userId = 1;
            const updateData = { name: 'New Name' };
            const mockUser = { id: userId, createdAt: new Date() } as any;

            prismaMock.user.update.mockResolvedValue({ ...mockUser, ...updateData });

            const result = await userService.updateProfile(userId, updateData);
            expect(result.name).toBe('New Name');
        });

        it('should throw UserNotFoundError when P2025 is returned', async () => {
            prismaMock.user.update.mockRejectedValue(prismaError('P2025'));

            await expect(
                userService.updateProfile(1, { name: 'New' })
            ).rejects.toBeInstanceOf(UserNotFoundError);
        });
    });
});
