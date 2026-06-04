import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { prismaMock } from '../mocks/prisma';
import { faker } from '@faker-js/faker';

vi.mock('../../src/generated/prisma/client', async () => {
    const actual = await vi.importActual<typeof import('../../src/generated/prisma/client')>(
        '../../src/generated/prisma/client'
    );
    return {
        ...actual,
        PrismaClient: vi.fn(() => prismaMock),
    };
});

vi.mock('../../src/lib/prisma', () => ({
    default: prismaMock
}));

const SIGNUP_MUTATION = `
    mutation Signup($email: String!, $username: String!, $password: String!) {
        signup(email: $email, username: $username, password: $password) {
            token
            user { id }
        }
    }
`;

const SIGNIN_MUTATION = `
    mutation Signin($email: String!, $password: String!) {
        signin(email: $email, password: $password) {
            token
        }
    }
`;

const UPDATE_PROFILE_MUTATION = `
    mutation UpdateProfile($name: String) {
        updateProfile(name: $name) {
            id
        }
    }
`;

describe('Error formatting integration', () => {
    let app: Hono;
    let jwtToken: string;

    beforeEach(async () => {
        vi.clearAllMocks();
        const { createApp } = await import('../../src/app');
        const { tokenService } = await import('../../src/utils/tokenService');
        app = await createApp();
        jwtToken = tokenService.sign({ id: 1 });
    });

    it('maps UserAlreadyExistsError to USER_ALREADY_EXISTS', async () => {
        const { Prisma } = await import('../../src/generated/prisma/client');
        prismaMock.user.create.mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
                code: 'P2002',
                clientVersion: '7.4.1',
            })
        );

        const response = await app.request('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: SIGNUP_MUTATION,
                variables: {
                    email: faker.internet.email().toLowerCase(),
                    username: faker.string.alphanumeric({ length: 10, casing: 'lower' }),
                    password: 'strong-password-123',
                },
            }),
        });

        const body = await response.json();
        expect(body.data).toBeNull();
        expect(body.errors[0].message).toContain('already exists');
        expect(body.errors[0].extensions.code).toBe('USER_ALREADY_EXISTS');
        expect(body.errors[0].extensions.httpStatus).toBe(409);
    });

    it('maps InvalidCredentialsError to INVALID_CREDENTIALS', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null);
        const { Argon2PasswordHasher } = await import('../../src/utils/passwordHasher');
        vi.spyOn(Argon2PasswordHasher.prototype, 'verify').mockResolvedValue(false);

        const response = await app.request('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: SIGNIN_MUTATION,
                variables: {
                    email: 'missing@example.com',
                    password: 'any-password-here',
                },
            }),
        });

        const body = await response.json();
        expect(body.data).toBeNull();
        expect(body.errors[0].extensions.code).toBe('INVALID_CREDENTIALS');
        expect(body.errors[0].extensions.httpStatus).toBe(401);
    });

    it('hides internal errors and returns INTERNAL_ERROR', async () => {
        prismaMock.user.create.mockRejectedValue(new Error('connection refused'));

        const response = await app.request('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: SIGNUP_MUTATION,
                variables: {
                    email: faker.internet.email().toLowerCase(),
                    username: faker.string.alphanumeric({ length: 10, casing: 'lower' }),
                    password: 'strong-password-123',
                },
            }),
        });

        const body = await response.json();
        expect(body.data).toBeNull();
        expect(body.errors[0].message).toBe('Internal server error');
        expect(body.errors[0].extensions.code).toBe('INTERNAL_ERROR');
    });

    it('returns UNAUTHORIZED for unauthenticated updateProfile', async () => {
        const response = await app.request('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: UPDATE_PROFILE_MUTATION,
                variables: { name: 'New' },
            }),
        });

        const body = await response.json();
        expect(body.errors[0].extensions.code).toBe('UNAUTHORIZED');
    });

    it('accepts an authenticated updateProfile and maps UserNotFoundError to USER_NOT_FOUND', async () => {
        const { Prisma } = await import('../../src/generated/prisma/client');
        prismaMock.user.update.mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError('Not found', {
                code: 'P2025',
                clientVersion: '7.4.1',
            })
        );

        const response = await app.request('/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${jwtToken}`,
            },
            body: JSON.stringify({
                query: UPDATE_PROFILE_MUTATION,
                variables: { name: 'New' },
            }),
        });

        const body = await response.json();
        expect(body.data).toBeNull();
        expect(body.errors[0].extensions.code).toBe('USER_NOT_FOUND');
        expect(body.errors[0].extensions.httpStatus).toBe(404);
    });
});
