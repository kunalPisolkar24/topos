import { GraphQLFormattedError, GraphQLError } from 'graphql';
import { isDomainError } from './DomainError';
import { InternalError } from './prismaError';
import { logger } from '../lib/logger';

export function formatGraphQLError(
    formattedError: GraphQLFormattedError,
    error: unknown
): GraphQLFormattedError {
    const domainError = unwrapDomainError(error);

    if (domainError) {
        logger.warn({
            msg: 'GraphQL domain error',
            code: domainError.code,
            message: domainError.message,
        });
        return {
            message: domainError.message,
            path: formattedError.path,
            locations: formattedError.locations,
            extensions: {
                code: domainError.code,
                httpStatus: domainError.httpStatus,
            },
        };
    }

    if (error instanceof GraphQLError) {
        return formattedError;
    }

    logger.error({
        msg: 'GraphQL unexpected error',
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        formattedError,
    });

    const internal = new InternalError(error);
    return {
        message: internal.message,
        path: formattedError.path,
        locations: formattedError.locations,
        extensions: {
            code: internal.code,
            httpStatus: internal.httpStatus,
        },
    };
}

function unwrapDomainError(error: unknown): import('./DomainError').DomainError | null {
    if (isDomainError(error)) {
        return error;
    }
    if (
        error instanceof Error &&
        'originalError' in error &&
        isDomainError((error as { originalError: unknown }).originalError)
    ) {
        return (error as { originalError: import('./DomainError').DomainError }).originalError;
    }
    return null;
}
