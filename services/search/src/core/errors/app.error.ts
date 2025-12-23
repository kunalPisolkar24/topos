export class AppError extends Error {
    public readonly isOperational: boolean;

    constructor(message: string, isOperational = true) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
        this.isOperational = isOperational;
        Error.captureStackTrace(this);
    }
}

export class InfrastructureError extends AppError {
    constructor(message: string) {
        super(message, true);
    }
}

export class ParseError extends AppError {
    constructor(message: string) {
        super(message, true);
    }
}

export class ValidationError extends AppError {
    constructor(message: string) {
        super(message, true);
    }
}