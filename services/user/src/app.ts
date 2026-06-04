import { Hono } from 'hono';
import { ApolloServer, HeaderMap } from '@apollo/server';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { ApolloServerPluginCacheControl } from '@apollo/server/plugin/cacheControl';
import { typeDefs } from './graphql/schema';
import { resolvers } from './graphql/resolvers';
import { createContext } from './context';
import { requestLogger } from './middleware/request-logger';
import { metricsMiddleware } from './middleware/metrics';
import { CacheFactory } from './lib/cache';
import { metrics } from './lib/metrics';
import prisma from './lib/prisma';
import { UserService } from './services/user.service';
import { CachedUserService } from './services/user.service.cached';
import { formatGraphQLError } from './errors/formatError';
import { streamGraphQLResponse } from './lib/graphqlResponse';

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

    const serviceCache = CacheFactory.createServiceCache();
    const apolloCache = CacheFactory.createApolloCache(serviceCache);

    const baseUserService = new UserService(prisma);
    const userService = new CachedUserService(baseUserService, serviceCache);

    const server = new ApolloServer({
        schema: buildSubgraphSchema({ typeDefs, resolvers: resolvers as any }),
        cache: apolloCache,
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

        return streamGraphQLResponse(response);
    });

    app.get('/metrics', async (c) => {
        c.header('Content-Type', metrics.register.contentType);
        return c.body(await metrics.register.metrics());
    });

    app.get('/health', (c) => c.text('User Service OK'));

    return {
        app,
        shutdown: async () => {
            await server.stop();
            await CacheFactory.disconnect(serviceCache);
        },
    };
}

