import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { prismaMock } from '../mocks/prisma';

vi.mock('../../src/generated/prisma/client', () => ({
    PrismaClient: vi.fn(() => prismaMock)
}));

vi.mock('../../src/lib/prisma', () => ({
    default: prismaMock
}));

describe('User Integration Tests', () => {
    let app: Hono;
    let jwtToken: string;

    beforeEach(async () => {
        vi.clearAllMocks();
        const { createApp } = await import('../../src/app');
        const { JwtUtils } = await import('../../src/utils/jwt');
        
        app = await createApp();
        jwtToken = JwtUtils.sign({ id: 1 });
    });

    const ME_QUERY = `
        query Me {
            me {
                id
                username
            }
        }
    `;

    const USER_QUERY = `
        query User($id: ID!) {
            user(id: $id) {
                id
                username
            }
        }
    `;

    const USERS_QUERY = `
        query Users {
            users(limit: 10) {
                id
                username
            }
        }
    `;

    const UPDATE_PROFILE_MUTATION = `
        mutation UpdateProfile($name: String) {
            updateProfile(name: $name) {
                id
                name
            }
        }
    `;

    it('query me - should return current user', async () => {
        const mockUser = {
            id: 1,
            username: 'me',
            email: 'me@test.com',
            createdAt: new Date(),
        };
        
        prismaMock.user.findUnique.mockResolvedValue(mockUser as any);
        prismaMock.user.findMany.mockResolvedValue([mockUser as any]);

        const response = await app.request('/graphql', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwtToken}`
            },
            body: JSON.stringify({ query: ME_QUERY }),
        });

        const body = await response.json();
        expect(body.data?.me?.username).toBe('me');
    });

    it('query me - should return null if not authenticated', async () => {
        const response = await app.request('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: ME_QUERY }),
        });

        const body = await response.json();
        expect(body.data.me).toBeNull();
    });

    it('query user - should return user by id', async () => {
        const mockUser = {
            id: 2,
            username: 'other',
            createdAt: new Date(),
        };
        
        prismaMock.user.findUnique.mockResolvedValue(mockUser as any);
        prismaMock.user.findMany.mockResolvedValue([mockUser as any]);

        const response = await app.request('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                query: USER_QUERY,
                variables: { id: "2" }
            }),
        });

        const body = await response.json();
        expect(body.data?.user?.username).toBe('other');
    });

    it('query users - should return list', async () => {
        prismaMock.user.findMany.mockResolvedValue([
            { id: 1, username: 'u1', createdAt: new Date() } as any
        ]);

        const response = await app.request('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: USERS_QUERY }),
        });

        const body = await response.json();
        expect(body.data.users).toHaveLength(1);
    });

    it('mutation updateProfile - should update user', async () => {
        const mockUser = { id: 1, name: 'Old', createdAt: new Date() } as any;
        prismaMock.user.findUnique.mockResolvedValue(mockUser);
        prismaMock.user.update.mockResolvedValue({ ...mockUser, name: 'New' });

        const response = await app.request('/graphql', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwtToken}`
            },
            body: JSON.stringify({ 
                query: UPDATE_PROFILE_MUTATION,
                variables: { name: 'New' }
            }),
        });

        const body = await response.json();
        expect(body.data.updateProfile.name).toBe('New');
    });

    it('mutation updateProfile - should fail if unauthorized', async () => {
        const response = await app.request('/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                query: UPDATE_PROFILE_MUTATION,
                variables: { name: 'New' }
            }),
        });

        const body = await response.json();
        expect(body.errors[0].message).toBe('Unauthorized');
    });
});