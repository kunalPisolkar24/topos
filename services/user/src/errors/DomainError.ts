export type DomainErrorCode =
    | 'USER_ALREADY_EXISTS'
    | 'INVALID_CREDENTIALS'
    | 'USER_NOT_FOUND'
    | 'VALIDATION_ERROR'
    | 'UNAUTHORIZED'
    | 'INTERNAL_ERROR';

export abstract class DomainError extends Error {
    abstract readonly code: DomainErrorCode;
    readonly httpStatus: number;

    constructor(message: string, httpStatus: number) {
        super(message);
        this.name = new.target.name;
        this.httpStatus = httpStatus;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

export class UserAlreadyExistsError extends DomainError {
    readonly code = 'USER_ALREADY_EXISTS' as const;
    constructor(message = 'A user with that email or username already exists') {
        super(message, 409);
    }
}

export class InvalidCredentialsError extends DomainError {
    readonly code = 'INVALID_CREDENTIALS' as const;
    constructor(message = 'Invalid email or password') {
        super(message, 401);
    }
}

export class UserNotFoundError extends DomainError {
    readonly code = 'USER_NOT_FOUND' as const;
    constructor(message = 'User not found') {
        super(message, 404);
    }
}

export class ValidationError extends DomainError {
    readonly code = 'VALIDATION_ERROR' as const;
    constructor(message = 'Invalid input') {
        super(message, 400);
    }
}

export class UnauthorizedError extends DomainError {
    readonly code = 'UNAUTHORIZED' as const;
    constructor(message = 'Authentication required') {
        super(message, 401);
    }
}

export function isDomainError(value: unknown): value is DomainError {
    return value instanceof DomainError;
}
