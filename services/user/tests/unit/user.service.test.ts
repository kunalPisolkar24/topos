import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService } from '../../src/services/user.service';
import { prismaMock } from '../mocks/prisma';
import { PasswordUtils } from '../../src/utils/password';
import { faker } from '@faker-js/faker';

describe('UserService Unit Tests', () => {
    let userService: UserService;

    beforeEach(() => {
        vi.clearAllMocks();
        userService = new UserService(prismaMock);
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

            expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
                where: {
                    OR: [{ email: signupInput.email }, { username: signupInput.username }],
                },
            });
            expect(prismaMock.user.create).toHaveBeenCalledWith({
                data: {
                    email: signupInput.email,
                    username: signupInput.username,
                    password: hashedPassword,
                    name: signupInput.username,
                },
            });
            expect(result.token).toBeDefined();
            expect(result.user.email).toBe(signupInput.email);
            expect(result.user.createdAt).toBe(now.toISOString());
        });

        it('should throw error when user already exists', async () => {
            const signupInput = {
                email: faker.internet.email(),
                username: faker.internet.username(),
                password: faker.internet.password(),
            };

            prismaMock.user.findFirst.mockResolvedValue({ id: 1 } as any);

            await expect(userService.signup(signupInput)).rejects.toThrow('User already exists');
            expect(prismaMock.user.create).not.toHaveBeenCalled();
        });
    });

    describe('signin', () => {
        it('should return token and user for valid credentials', async () => {
            const password = faker.internet.password();
            const hashedPassword = 'hashed_password_mock';
            const userMock = {
                id: faker.number.int(),
                email: faker.internet.email(),
                username: faker.internet.username(),
                password: hashedPassword,
                createdAt: new Date(),
            } as any;

            prismaMock.user.findUnique.mockResolvedValue(userMock);
            vi.spyOn(PasswordUtils, 'compare').mockResolvedValue(true);

            const result = await userService.signin({
                email: userMock.email,
                password: password,
            });

            expect(result.token).toBeDefined();
            expect(result.user.id).toBe(userMock.id);
        });

        it('should throw error for non-existent user', async () => {
            prismaMock.user.findUnique.mockResolvedValue(null);

            await expect(userService.signin({
                email: faker.internet.email(),
                password: 'any',
            })).rejects.toThrow('Invalid credentials');
        });

        it('should throw error for invalid password', async () => {
            const userMock = {
                id: 1,
                email: faker.internet.email(),
                password: 'hashed',
            } as any;

            prismaMock.user.findUnique.mockResolvedValue(userMock);
            vi.spyOn(PasswordUtils, 'compare').mockResolvedValue(false);

            await expect(userService.signin({
                email: userMock.email,
                password: 'wrong',
            })).rejects.toThrow('Invalid credentials');
        });
    });
});