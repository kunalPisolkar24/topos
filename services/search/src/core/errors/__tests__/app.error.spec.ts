import { describe, it, expect } from 'vitest';
import { AppError, InfrastructureError, ParseError, ValidationError } from '../app.error.js';

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
});
