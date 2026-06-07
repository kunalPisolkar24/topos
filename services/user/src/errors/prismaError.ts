import { Prisma } from '../generated/prisma/client';
import { DomainError, UserAlreadyExistsError, UserNotFoundError } from './DomainError';

export function toDomainError(error: unknown): DomainError {
    if (error instanceof DomainError) {
        return error;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
            case 'P2002':
                return new UserAlreadyExistsError();
            case 'P2025':
                return new UserNotFoundError();
            default:
                break;
        }
    }

    throw error;
}

export class InternalError extends DomainError {
    readonly code = 'INTERNAL_ERROR' as const;
    constructor(cause?: unknown, message = 'Internal server error') {
        super(message, 500);
        if (cause !== undefined) {
            (this as Error & { cause?: unknown }).cause = cause;
        }
    }
}
