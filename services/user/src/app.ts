import { Hono } from 'hono';
import { ApolloServer, HeaderMap } from '@apollo/server';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { ApolloServerPluginCacheControl } from '@apollo/server/plugin/cacheControl';
import { typeDefs } from './graphql/schema';
import { resolvers } from './graphql/resolvers';
import { createContext } from './context';
import { requestLogger } from './middleware/request-logger';
import { metricsMiddleware } from './middleware/metrics';
import { logger } from './lib/logger';
import { CacheFactory, serviceCache } from './lib/cache';
import { metrics } from './lib/metrics';
import prisma from './lib/prisma';
import { UserService } from './services/user.service';
import { CachedUserService } from './services/user.service.cached';
import { formatGraphQLError } from './errors/formatError';

export async function createApp() {
    const app = new Hono();

    app.use('*', requestLogger);
    app.use('*', metricsMiddleware);

    const cacheBackend = CacheFactory.createCache();

    const baseUserService = new UserService(prisma);
    
    const userService = serviceCache 
        ? new CachedUserService(baseUserService, serviceCache)
        : baseUserService;

    const server = new ApolloServer({
        schema: buildSubgraphSchema({ typeDefs, resolvers: resolvers as any }),
        cache: cacheBackend,
        plugins: [
            ApolloServerPluginCacheControl({ defaultMaxAge: 0 }),
        ],
        formatError: formatGraphQLError,
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
            context: () => createContext(c, userService),
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

    app.get('/metrics', async (c) => {
        c.header('Content-Type', metrics.register.contentType);
        return c.body(await metrics.register.metrics());
    });

    app.get('/health', (c) => c.text('User Service OK'));

    return app;
}