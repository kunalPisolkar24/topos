import { describe, it, expect, vi } from 'vitest';
import { JwtUtils } from '../../src/utils/jwt';
import { PasswordUtils } from '../../src/utils/password';
import jwt from 'jsonwebtoken';

describe('Utils Tests', () => {
    describe('JwtUtils', () => {
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
    });

    describe('PasswordUtils', () => {
        it('should verify correct password', async () => {
            const hash = await PasswordUtils.hash('password');
            const isValid = await PasswordUtils.compare('password', hash);
            expect(isValid).toBe(true);
        });

        it('should reject incorrect password', async () => {
            const hash = await PasswordUtils.hash('password');
            const isValid = await PasswordUtils.compare('wrong', hash);
            expect(isValid).toBe(false);
        });
    });
});