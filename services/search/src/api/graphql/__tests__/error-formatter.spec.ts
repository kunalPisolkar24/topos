import { describe, it, expect } from 'vitest';
import { GraphQLError } from 'graphql';
import { formatGraphQLError } from '../error-formatter.js';
import {
    AppError,
    ValidationError,
    UnauthorizedError,
    NotFoundError,
    InfrastructureError,
    BulkPartialFailureError,
} from '../../../core/errors/app.error.js';

const buildFormatter = (isProduction: boolean) =>
    formatGraphQLError({ isProduction });

describe('formatGraphQLError', () => {
    it('maps ValidationError to BAD_USER_INPUT', () => {
        const fmt = buildFormatter(false);
        const err = new ValidationError('bad query');
        const formatted = fmt({ message: 'bad query', path: ['q'] }, err);
        expect(formatted.extensions?.code).toBe('BAD_USER_INPUT');
        expect(formatted.message).toBe('bad query');
    });

    it('maps UnauthorizedError to UNAUTHENTICATED', () => {
        const fmt = buildFormatter(false);
        const err = new UnauthorizedError();
        const formatted = fmt({ message: 'no' }, err);
        expect(formatted.extensions?.code).toBe('UNAUTHENTICATED');
    });

    it('maps NotFoundError to NOT_FOUND', () => {
        const fmt = buildFormatter(false);
        const err = new NotFoundError('missing');
        const formatted = fmt({ message: 'missing' }, err);
        expect(formatted.extensions?.code).toBe('NOT_FOUND');
    });

    it('maps InfrastructureError to INTERNAL_SERVER_ERROR', () => {
        const fmt = buildFormatter(false);
        const err = new InfrastructureError('es down');
        const formatted = fmt({ message: 'es down' }, err);
        expect(formatted.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('maps a generic AppError to INTERNAL_SERVER_ERROR', () => {
        const fmt = buildFormatter(false);
        const err = new AppError('misc');
        const formatted = fmt({ message: 'misc' }, err);
        expect(formatted.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('redacts the message for INTERNAL_SERVER_ERROR in production', () => {
        const fmt = buildFormatter(true);
        const err = new InfrastructureError('with secret token=abc');
        const formatted = fmt(
            { message: 'with secret token=abc', path: ['q'] },
            err
        );
        expect(formatted.message).toBe('Internal server error');
        expect(formatted.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('preserves user-facing messages in production when code is not internal', () => {
        const fmt = buildFormatter(true);
        const err = new ValidationError('field required');
        const formatted = fmt({ message: 'field required', path: ['q'] }, err);
        expect(formatted.message).toBe('field required');
    });

    it('wraps a raw GraphQLError that has no originalError', () => {
        const fmt = buildFormatter(false);
        const err = new GraphQLError('syntax');
        const formatted = fmt({ message: 'syntax' }, err);
        expect(formatted.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('handles BulkPartialFailureError by mapping to INTERNAL_SERVER_ERROR', () => {
        const fmt = buildFormatter(false);
        const err = new BulkPartialFailureError('partial', {
            operation: 'bulk_upsert',
            failedIds: [],
        });
        const formatted = fmt({ message: 'partial' }, err);
        expect(formatted.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
    });
});
