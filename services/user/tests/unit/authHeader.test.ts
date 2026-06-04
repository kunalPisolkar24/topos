import { describe, it, expect } from 'vitest';
import { extractBearerToken } from '../../src/utils/authHeader';

describe('extractBearerToken', () => {
    it('extracts a standard bearer token', () => {
        expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    });

    it('is case-insensitive for the scheme', () => {
        expect(extractBearerToken('bearer abc.def.ghi')).toBe('abc.def.ghi');
        expect(extractBearerToken('BEARER abc.def.ghi')).toBe('abc.def.ghi');
    });

    it('tolerates extra whitespace before the token', () => {
        expect(extractBearerToken('Bearer    abc.def.ghi')).toBe('abc.def.ghi');
    });

    it('tolerates a tab separator', () => {
        expect(extractBearerToken('Bearer\tabc.def.ghi')).toBe('abc.def.ghi');
    });

    it('returns null for missing header', () => {
        expect(extractBearerToken(undefined)).toBeNull();
    });

    it('returns null for empty header', () => {
        expect(extractBearerToken('')).toBeNull();
    });

    it('returns null for non-bearer schemes', () => {
        expect(extractBearerToken('Basic abcdef')).toBeNull();
    });

    it('returns null when token is missing', () => {
        expect(extractBearerToken('Bearer')).toBeNull();
        expect(extractBearerToken('Bearer ')).toBeNull();
    });

    it('returns null for scheme-only with garbage', () => {
        expect(extractBearerToken('NotBearer abc')).toBeNull();
    });
});
