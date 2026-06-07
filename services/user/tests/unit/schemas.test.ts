import { describe, it, expect } from 'vitest';
import { signupSchema, signinSchema, updateProfileSchema } from '../../src/types';

describe('signupSchema', () => {
    it('normalizes email and username', () => {
        const result = signupSchema.parse({
            email: '  Foo@Example.COM  ',
            username: '  Some_User_42  ',
            password: 'a-strong-password-12',
        });
        expect(result.email).toBe('foo@example.com');
        expect(result.username).toBe('some_user_42');
    });

    it('rejects usernames with invalid characters', () => {
        const result = signupSchema.safeParse({
            email: 'a@b.com',
            username: 'has space',
            password: 'a-strong-password-12',
        });
        expect(result.success).toBe(false);
    });

    it('rejects usernames shorter than 3', () => {
        const result = signupSchema.safeParse({
            email: 'a@b.com',
            username: 'ab',
            password: 'a-strong-password-12',
        });
        expect(result.success).toBe(false);
    });

    it('rejects passwords shorter than 12', () => {
        const result = signupSchema.safeParse({
            email: 'a@b.com',
            username: 'valid_user',
            password: 'short1A',
        });
        expect(result.success).toBe(false);
    });

    it('rejects passwords without digits', () => {
        const result = signupSchema.safeParse({
            email: 'a@b.com',
            username: 'valid_user',
            password: 'alllettersonlyword',
        });
        expect(result.success).toBe(false);
    });

    it('rejects passwords without letters', () => {
        const result = signupSchema.safeParse({
            email: 'a@b.com',
            username: 'valid_user',
            password: '123456789012',
        });
        expect(result.success).toBe(false);
    });

    it('rejects invalid email format', () => {
        const result = signupSchema.safeParse({
            email: 'not-an-email',
            username: 'valid_user',
            password: 'a-strong-password-12',
        });
        expect(result.success).toBe(false);
    });
});

describe('signinSchema', () => {
    it('normalizes email and accepts short password', () => {
        const result = signinSchema.parse({
            email: '  USER@example.com  ',
            password: 'x',
        });
        expect(result.email).toBe('user@example.com');
    });

    it('rejects empty password', () => {
        const result = signinSchema.safeParse({ email: 'a@b.com', password: '' });
        expect(result.success).toBe(false);
    });
});

describe('updateProfileSchema', () => {
    it('rejects name longer than 80', () => {
        const result = updateProfileSchema.safeParse({ name: 'a'.repeat(81) });
        expect(result.success).toBe(false);
    });

    it('rejects bio longer than 500', () => {
        const result = updateProfileSchema.safeParse({ bio: 'a'.repeat(501) });
        expect(result.success).toBe(false);
    });

    it('accepts null bio to clear it', () => {
        const result = updateProfileSchema.parse({ bio: null });
        expect(result.bio).toBeNull();
    });

    it('rejects non-http URLs', () => {
        const result = updateProfileSchema.safeParse({ avatarUrl: 'javascript:alert(1)' });
        expect(result.success).toBe(false);
    });

    it('rejects URLs longer than 2048', () => {
        const result = updateProfileSchema.safeParse({ avatarUrl: `https://x.com/${'a'.repeat(2050)}` });
        expect(result.success).toBe(false);
    });
});
