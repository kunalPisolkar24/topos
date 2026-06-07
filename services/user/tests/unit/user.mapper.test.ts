import { describe, it, expect } from 'vitest';
import { toUserResponse } from '../../src/services/user.mapper';

describe('toUserResponse', () => {
    it('maps a User row to a UserResponse, stringifying createdAt', () => {
        const createdAt = new Date('2026-01-15T10:00:00.000Z');
        const user = {
            id: 1,
            username: 'alice',
            email: 'alice@example.com',
            name: 'Alice',
            bio: 'bio',
            avatarUrl: 'https://example.com/a.png',
            bannerUrl: 'https://example.com/b.png',
            createdAt,
        } as any;

        expect(toUserResponse(user)).toEqual({
            id: 1,
            username: 'alice',
            email: 'alice@example.com',
            name: 'Alice',
            bio: 'bio',
            avatarUrl: 'https://example.com/a.png',
            bannerUrl: 'https://example.com/b.png',
            createdAt: '2026-01-15T10:00:00.000Z',
        });
    });

    it('preserves null optional fields', () => {
        const user = {
            id: 2,
            username: 'bob',
            email: 'bob@example.com',
            name: null,
            bio: null,
            avatarUrl: null,
            bannerUrl: null,
            createdAt: new Date('2026-02-01T00:00:00.000Z'),
        } as any;

        expect(toUserResponse(user)).toEqual({
            id: 2,
            username: 'bob',
            email: 'bob@example.com',
            name: null,
            bio: null,
            avatarUrl: null,
            bannerUrl: null,
            createdAt: '2026-02-01T00:00:00.000Z',
        });
    });
});
