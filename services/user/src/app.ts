import { Hono } from 'hono';
import { ApolloServer, HeaderMap } from '@apollo/server';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { typeDefs } from './graphql/schema';
import { resolvers } from './graphql/resolvers';
import { createContext } from './context';
import { rateLimitMiddleware } from './middleware/rate-limit';
import { requestLogger } from './middleware/request-logger';
import { logger } from './lib/logger';

export async function createApp() {
    const app = new Hono();

    app.use('*', requestLogger);
    app.use('*', rateLimitMiddleware);

    const server = new ApolloServer({
        schema: buildSubgraphSchema({ typeDefs, resolvers: resolvers as any }),
        formatError: (formattedError, error) => {
            logger.error({
                msg: 'GraphQL Error',
                error: formattedError,
                originalError: error
            });
            return formattedError;
        },
    });

    await server.start();

    app.use('/graphql', async (c) => {
        const httpHeaders = new HeaderMap();
        c.req.raw.headers.forEach((value, key) => {
            httpHeaders.set(key, value);
        });

        const httpGraphQLRequest = {
            method: c.req.method,
            headers: httpHeaders,
            search: new URL(c.req.url).search ?? '',
            body: await c.req.json().catch(() => ({})),
        };

        const response = await server.executeHTTPGraphQLRequest({
            httpGraphQLRequest,
            context: () => createContext(c),
        });

        const responseHeaders: Record<string, string> = {};
        for (const [key, value] of response.headers) {
            responseHeaders[key] = value;
        }

        return new Response(
            response.body.kind === 'complete' ? response.body.string : '',
            {
                status: response.status || 200,
                headers: responseHeaders,
            }
        );
    });

    app.get('/health', (c) => c.text('User Service OK'));

    return app;
}