import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { prismaMock } from '../mocks/prisma';
import { faker } from '@faker-js/faker';

vi.mock('../../src/generated/prisma/client', () => ({
    PrismaClient: vi.fn(() => prismaMock)
}));

vi.mock('../../src/lib/prisma', () => ({
    default: prismaMock
}));

describe('Auth Integration Tests', () => {
    let app: Hono;

    beforeEach(async () => {
        vi.clearAllMocks();
        const { createApp } = await import('../../src/app');
        app = await createApp();
    });

    const SIGNUP_MUTATION = `
        mutation Signup($email: String!, $username: String!, $password: String!) {
            signup(email: $email, username: $username, password: $password) {
                token
                user {
                    id
                    username
                    email
                }
            }
        }
    `;

    const SIGNIN_MUTATION = `
        mutation Signin($email: String!, $password: String!) {
            signin(email: $email, password: $password) {
                token
                user {
                    id
                    username
                }
            }
        }
    `;

    it('POST /graphql - Signup flow', async () => {
        const payload = {
            email: faker.internet.email(),
            username: faker.internet.username(),
            password: 'securePassword123!',
        };

        prismaMock.user.findFirst.mockResolvedValue(null);
        prismaMock.user.create.mockResolvedValue({
            id: 123,
            email: payload.email,
            username: payload.username,
            password: 'hashed',
            createdAt: new Date(),
            name: payload.username,
            bio: null,
            avatarUrl: null,
            bannerUrl: null,
        } as any);

        const response = await app.request('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: SIGNUP_MUTATION,
                variables: payload,
            }),
        });

        expect(response.status).toBe(200);
        const body = await response.json();

        expect(body.data.signup.user.email).toBe(payload.email);
        expect(body.data.signup.token).toBeDefined();
        expect(body.errors).toBeUndefined();
    });

    it('POST /graphql - Signin flow', async () => {
        const email = faker.internet.email();
        const userMock = {
            id: 456,
            email: email,
            username: 'existing_user',
            password: 'hashed_password',
            createdAt: new Date(),
        } as any;

        const { PasswordUtils } = await import('../../src/utils/password');
        vi.spyOn(PasswordUtils, 'compare').mockResolvedValue(true);

        prismaMock.user.findUnique.mockResolvedValue(userMock);

        const response = await app.request('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: SIGNIN_MUTATION,
                variables: {
                    email: email,
                    password: 'password123',
                },
            }),
        });

        expect(response.status).toBe(200);
        const body = await response.json();

        expect(body.data?.signin.user.id).toBe('456');
        expect(body.data?.signin.token).toBeDefined();
        expect(body.errors).toBeUndefined();
    });

    it('GET /health - Health check', async () => {
        const response = await app.request('/health');
        expect(response.status).toBe(200);
        expect(await response.text()).toBe('User Service OK');
    });
});