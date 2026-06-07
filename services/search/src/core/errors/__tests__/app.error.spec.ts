import { describe, it, expect } from 'vitest';
import {
    AppError,
    InfrastructureError,
    ParseError,
    ValidationError,
    UnauthorizedError,
    NotFoundError,
    BulkPartialFailureError,
} from '../app.error.js';

describe('Error Classes', () => {
    describe('AppError', () => {
        it('should create error with message', () => {
            const error = new AppError('Test error');

            expect(error.message).toBe('Test error');
            expect(error.isOperational).toBe(true);
        });

        it('should create error with isOperational false', () => {
            const error = new AppError('Critical error', false);

            expect(error.message).toBe('Critical error');
            expect(error.isOperational).toBe(false);
        });

        it('should be instance of Error', () => {
            const error = new AppError('Test error');

            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(AppError);
        });

        it('should have stack trace', () => {
            const error = new AppError('Test error');

            expect(error.stack).toBeDefined();
        });
    });

    describe('InfrastructureError', () => {
        it('should create error with message', () => {
            const error = new InfrastructureError('DB connection failed');

            expect(error.message).toBe('DB connection failed');
            expect(error.isOperational).toBe(true);
        });

        it('should be instance of AppError', () => {
            const error = new InfrastructureError('Test');

            expect(error).toBeInstanceOf(AppError);
            expect(error).toBeInstanceOf(InfrastructureError);
        });
    });

    describe('ParseError', () => {
        it('should create error with message', () => {
            const error = new ParseError('Invalid JSON');

            expect(error.message).toBe('Invalid JSON');
            expect(error.isOperational).toBe(true);
        });

        it('should be instance of AppError', () => {
            const error = new ParseError('Test');

            expect(error).toBeInstanceOf(AppError);
            expect(error).toBeInstanceOf(ParseError);
        });
    });

    describe('ValidationError', () => {
        it('should create error with message', () => {
            const error = new ValidationError('Invalid input');

            expect(error.message).toBe('Invalid input');
            expect(error.isOperational).toBe(true);
        });

        it('should be instance of AppError', () => {
            const error = new ValidationError('Test');

            expect(error).toBeInstanceOf(AppError);
            expect(error).toBeInstanceOf(ValidationError);
        });
    });

    describe('UnauthorizedError', () => {
        it('should default to "Unauthorized" message', () => {
            const error = new UnauthorizedError();

            expect(error.message).toBe('Unauthorized');
            expect(error.isOperational).toBe(true);
            expect(error).toBeInstanceOf(AppError);
            expect(error).toBeInstanceOf(UnauthorizedError);
        });

        it('should accept a custom message', () => {
            const error = new UnauthorizedError('Token expired');

            expect(error.message).toBe('Token expired');
        });
    });

    describe('NotFoundError', () => {
        it('should create error with message', () => {
            const error = new NotFoundError('Index posts not found');

            expect(error.message).toBe('Index posts not found');
            expect(error.isOperational).toBe(true);
            expect(error).toBeInstanceOf(AppError);
            expect(error).toBeInstanceOf(NotFoundError);
        });
    });

    describe('BulkPartialFailureError', () => {
        it('should carry failed id metadata', () => {
            const failedIds = [
                { id: 'a', status: 400, reason: 'mapper_parsing_exception' },
                { id: 'b', status: 409, reason: 'version_conflict' },
            ];
            const error = new BulkPartialFailureError('partial bulk failure', {
                operation: 'bulk_upsert',
                failedIds,
            });

            expect(error.message).toBe('partial bulk failure');
            expect(error.isOperational).toBe(true);
            expect(error).toBeInstanceOf(AppError);
            expect(error).toBeInstanceOf(BulkPartialFailureError);
            expect(error.meta.operation).toBe('bulk_upsert');
            expect(error.meta.failedIds).toEqual(failedIds);
        });

        it('should accept bulk_delete operation', () => {
            const error = new BulkPartialFailureError('partial delete', {
                operation: 'bulk_delete',
                failedIds: [{ id: 'x' }],
            });

            expect(error.meta.operation).toBe('bulk_delete');
        });
    });
});
