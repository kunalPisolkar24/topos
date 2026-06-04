import { describe, it, expect, vi } from 'vitest';
import { JwtUtils } from '../../src/utils/jwt';
import { Argon2PasswordHasher } from '../../src/utils/passwordHasher';
import jwt from 'jsonwebtoken';
import { env } from '../../src/config/env';

describe('Utils Tests', () => {
    describe('JwtUtils', () => {
        it('round-trips a valid payload', () => {
            const token = JwtUtils.sign({ id: 42 });
            const result = JwtUtils.verify(token);
            expect(result).not.toBeNull();
            expect(result?.id).toBe(42);
        });

        it('should return null for invalid token', () => {
            const result = JwtUtils.verify('invalid.token.here');
            expect(result).toBeNull();
        });

        it('should return null when verification throws', () => {
            vi.spyOn(jwt, 'verify').mockImplementation(() => {
                throw new Error('Boom');
            });
            const result = JwtUtils.verify('token');
            expect(result).toBeNull();
        });

        it('should return null when payload id is not a positive integer', () => {
            const token = jwt.sign({ id: '1' }, env.JWT_SECRET, {
                algorithm: 'HS256',
                issuer: env.JWT_ISSUER,
                audience: env.JWT_AUDIENCE,
            });
            expect(JwtUtils.verify(token)).toBeNull();
        });

        it('should return null when issuer does not match', () => {
            const token = jwt.sign({ id: 1 }, env.JWT_SECRET, {
                algorithm: 'HS256',
                issuer: 'someone-else',
                audience: env.JWT_AUDIENCE,
            });
            expect(JwtUtils.verify(token)).toBeNull();
        });

        it('should return null when audience does not match', () => {
            const token = jwt.sign({ id: 1 }, env.JWT_SECRET, {
                algorithm: 'HS256',
                issuer: env.JWT_ISSUER,
                audience: 'someone-else',
            });
            expect(JwtUtils.verify(token)).toBeNull();
        });

        it('should return null for an expired token', () => {
            const token = jwt.sign({ id: 1 }, env.JWT_SECRET, {
                algorithm: 'HS256',
                issuer: env.JWT_ISSUER,
                audience: env.JWT_AUDIENCE,
                expiresIn: '-1s',
            });
            expect(JwtUtils.verify(token)).toBeNull();
        });
    });

    describe('Argon2PasswordHasher', () => {
        const hasher = new Argon2PasswordHasher();

        it('should verify correct password', async () => {
            const hash = await hasher.hash('a-strong-password-12');
            const isValid = await hasher.verify('a-strong-password-12', hash);
            expect(isValid).toBe(true);
        });

        it('should reject incorrect password', async () => {
            const hash = await hasher.hash('a-strong-password-12');
            const isValid = await hasher.verify('wrong-password-xx', hash);
            expect(isValid).toBe(false);
        });

        it('should return false for a malformed hash', async () => {
            const isValid = await hasher.verify('any-password-here', 'not-a-real-hash');
            expect(isValid).toBe(false);
        });
    });
});