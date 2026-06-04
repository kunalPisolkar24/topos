import { Hono } from 'hono';
import { HeaderMap } from '@apollo/server';
import { createContext } from './context';
import { requestLogger } from './middleware/request-logger';
import { metricsMiddleware } from './middleware/metrics';
import { metrics } from './lib/metrics';
import prisma from './lib/prisma';
import { streamGraphQLResponse } from './lib/graphqlResponse';
import { checkDependencies, withTimeout } from './lib/ready';
import { PayloadTooLargeError, isDomainError } from './errors/DomainError';
import { logger } from './lib/logger';
import { OperationKind } from './context';
import { composeApp } from './composition';

const GRAPHQL_MAX_BODY_BYTES = 1 * 1024 * 1024;

const pickString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.length > 0 ? value : undefined;

export interface AppHandle {
    app: Hono;
    shutdown: () => Promise<void>;
}

export async function createApp(): Promise<Hono> {
    return (await buildApp()).app;
}

export async function buildApp(): Promise<AppHandle> {
    const app = new Hono();

    app.use('*', requestLogger);
    app.use('*', metricsMiddleware);

    app.onError((error, c) => {
        if (isDomainError(error)) {
            logger.warn({
                msg: 'Request rejected with domain error',
                code: error.code,
                message: error.message,
            });
            return c.json(
                { error: { code: error.code, message: error.message } },
                error.httpStatus as 400 | 401 | 404 | 409 | 413 | 500
            );
        }
        logger.error({
            msg: 'Unhandled request error',
            error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        });
        return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, 500);
    });

    const composed = await composeApp({ prisma });
    const { apolloServer, userService, serviceCache, cacheBackend } = composed;

    app.use('/graphql', async (c) => {
        const contentLengthHeader = c.req.header('content-length');
        if (contentLengthHeader) {
            const contentLength = parseInt(contentLengthHeader, 10);
            if (Number.isFinite(contentLength) && contentLength > GRAPHQL_MAX_BODY_BYTES) {
                throw new PayloadTooLargeError(
                    `GraphQL request body exceeds ${GRAPHQL_MAX_BODY_BYTES} bytes`
                );
            }
        }

        const rawBody = await c.req.raw.text();
        if (Buffer.byteLength(rawBody, 'utf8') > GRAPHQL_MAX_BODY_BYTES) {
            throw new PayloadTooLargeError(
                `GraphQL request body exceeds ${GRAPHQL_MAX_BODY_BYTES} bytes`
            );
        }

        const parsedBody = rawBody.length > 0 ? JSON.parse(rawBody) : {};
        const operationName = pickString(parsedBody?.operationName) ?? 'anonymous';
        const queryText = pickString(parsedBody?.query) ?? '';
        const operationKind: OperationKind = queryText.trimStart().startsWith('mutation')
            ? 'mutation'
            : queryText.trimStart().startsWith('subscription')
            ? 'subscription'
            : 'query';
        const stopTimer = metrics.graphqlOperationDuration.startTimer({
            operation: operationName,
            kind: operationKind,
        });

        const httpHeaders = new HeaderMap();
        c.req.raw.headers.forEach((value, key) => {
            httpHeaders.set(key, value);
        });

        const httpGraphQLRequest = {
            method: c.req.method,
            headers: httpHeaders,
            search: new URL(c.req.url).search ?? '',
            body: parsedBody,
        };

        try {
            const response = await apolloServer.executeHTTPGraphQLRequest({
                httpGraphQLRequest,
                context: () =>
                    createContext(c, userService, {
                        operationName,
                        operationKind,
                    }),
            });
            const httpStatus = response.status ?? 200;
            stopTimer({ status: httpStatus >= 400 ? 'error' : 'success' });
            return streamGraphQLResponse(response);
        } catch (error) {
            stopTimer({ status: 'error' });
            throw error;
        }
    });

    app.get('/metrics', async (c) => {
        c.header('Content-Type', metrics.register.contentType);
        return c.body(await metrics.register.metrics());
    });

    app.get('/health', (c) => c.text('User Service OK'));

    app.get('/ready', async (c) => {
        const ready = await withTimeout(checkDependencies(prisma, serviceCache), 500);
        if (ready.ok) {
            return c.json({ status: 'ready', checks: ready.checks });
        }
        return c.json({ status: 'unavailable', checks: ready.checks }, 503);
    });

    return {
        app,
        shutdown: composed.shutdown,
    };
}

