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

export class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
        super(message, true);
    }
}

export class NotFoundError extends AppError {
    constructor(message: string) {
        super(message, true);
    }
}

export interface BulkPartialFailureMeta {
    operation: 'bulk_upsert' | 'bulk_delete';
    failedIds: Array<{ id: string; status?: number; reason?: string }>;
}

export class BulkPartialFailureError extends AppError {
    public readonly meta: BulkPartialFailureMeta;

    constructor(message: string, meta: BulkPartialFailureMeta) {
        super(message, true);
        this.meta = meta;
    }
}
