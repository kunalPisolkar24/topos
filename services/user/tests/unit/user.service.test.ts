import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService } from '../../src/services/user.service';
import { prismaMock } from '../mocks/prisma';
import { PasswordUtils } from '../../src/utils/password';
import { faker } from '@faker-js/faker';

describe('UserService Unit Tests', () => {
    let userService: UserService;

    beforeEach(() => {
        vi.clearAllMocks();
        userService = new UserService(prismaMock as any);
    });

    describe('signup', () => {
        it('should successfully create a new user', async () => {
            const signupInput = {
                email: faker.internet.email(),
                username: faker.internet.username(),
                password: faker.internet.password(),
            };

            const hashedPassword = 'hashed_password_mock';
            const userId = faker.number.int();
            const now = new Date();

            prismaMock.user.findFirst.mockResolvedValue(null);
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
        });

        it('should throw error when user already exists', async () => {
            prismaMock.user.findFirst.mockResolvedValue({ id: 1 } as any);
            await expect(userService.signup({
                email: faker.internet.email(),
                username: faker.internet.username(),
                password: 'password'
            })).rejects.toThrow('User already exists');
        });
    });

    describe('signin', () => {
        it('should return token and user for valid credentials', async () => {
            const userMock = {
                id: 1,
                email: 'test@test.com',
                password: 'hashed',
                createdAt: new Date(),
            } as any;

            prismaMock.user.findUnique.mockResolvedValue(userMock);
            vi.spyOn(PasswordUtils, 'compare').mockResolvedValue(true);

            const result = await userService.signin({
                email: userMock.email,
                password: 'password',
            });

            expect(result.token).toBeDefined();
        });

        it('should throw error for non-existent user', async () => {
            prismaMock.user.findUnique.mockResolvedValue(null);
            await expect(userService.signin({
                email: 'test@test.com',
                password: 'any',
            })).rejects.toThrow('Invalid credentials');
        });

        it('should throw error for invalid password', async () => {
            prismaMock.user.findUnique.mockResolvedValue({ password: 'hash' } as any);
            vi.spyOn(PasswordUtils, 'compare').mockResolvedValue(false);
            await expect(userService.signin({
                email: 'test@test.com',
                password: 'wrong',
            })).rejects.toThrow('Invalid credentials');
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
        it('should return users mapped by id', async () => {
            const ids = [1, 2];
            const mockUsers = [
                { id: 1, createdAt: new Date() },
                { id: 2, createdAt: new Date() }
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
            
            expect(prismaMock.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
                skip: 1,
                cursor: { id: 5 }
            }));
        });
    });

    describe('updateProfile', () => {
        it('should update user successfully', async () => {
            const userId = 1;
            const updateData = { name: 'New Name' };
            const mockUser = { id: userId, createdAt: new Date() } as any;
            
            prismaMock.user.findUnique.mockResolvedValue(mockUser);
            prismaMock.user.update.mockResolvedValue({ ...mockUser, ...updateData });

            const result = await userService.updateProfile(userId, updateData);
            expect(result.name).toBe('New Name');
        });

        it('should throw error if user not found', async () => {
            prismaMock.user.findUnique.mockResolvedValue(null);
            await expect(userService.updateProfile(1, {}))
                .rejects.toThrow('User not found');
        });
    });
});