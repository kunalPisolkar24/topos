import { GraphQLError, GraphQLFormattedError } from 'graphql';
import { AppError, ValidationError, UnauthorizedError, NotFoundError, InfrastructureError } from '../../core/errors/app.error.js';

interface FormatOptions {
    isProduction: boolean;
}

const toExtensionCode = (err: Error): string => {
    if (err instanceof ValidationError) return 'BAD_USER_INPUT';
    if (err instanceof UnauthorizedError) return 'UNAUTHENTICATED';
    if (err instanceof NotFoundError) return 'NOT_FOUND';
    if (err instanceof InfrastructureError) return 'INTERNAL_SERVER_ERROR';
    if (err instanceof AppError) return 'INTERNAL_SERVER_ERROR';
    return 'INTERNAL_SERVER_ERROR';
};

export const formatGraphQLError = (
    options: FormatOptions
) => (formattedError: GraphQLFormattedError, error: unknown): GraphQLFormattedError => {
    const original = (error as GraphQLError | undefined) ?? undefined;
    const originalError = original?.originalError ?? (error as Error | undefined);

    const code = toExtensionCode(originalError ?? new Error(formattedError.message));

    if (options.isProduction) {
        const safeMessage =
            code === 'INTERNAL_SERVER_ERROR' ? 'Internal server error' : formattedError.message;
        return {
            message: safeMessage,
            path: formattedError.path,
            extensions: {
                code,
                ...(formattedError.extensions ?? {}),
            },
        };
    }

    return {
        message: formattedError.message,
        path: formattedError.path,
        locations: formattedError.locations,
        extensions: {
            code,
            ...(formattedError.extensions ?? {}),
        },
    };
};
