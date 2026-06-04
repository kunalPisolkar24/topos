import Keyv from 'keyv';
import { KeyvAdapter } from '@apollo/utils.keyvadapter';
import { ApolloServer } from '@apollo/server';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { ApolloServerPluginCacheControl } from '@apollo/server/plugin/cacheControl';
import { typeDefs } from './graphql/schema';
import { resolvers } from './graphql/resolvers';
import { UserService } from './services/user.service';
import { CachedUserService } from './services/user.service.cached';
import { selectCacheBackend, CacheBackend } from './lib/cache';
import { formatGraphQLError } from './errors/formatError';
import { PrismaClient } from './generated/prisma/client';
import { tokenService, TokenService } from './utils/tokenService';
import { passwordHasher, PasswordHasher } from './utils/passwordHasher';

export interface AppDependencies {
    prisma: PrismaClient;
    cacheBackend?: CacheBackend;
    passwordHasher?: PasswordHasher;
    tokenService?: TokenService;
}

export interface ComposedApp {
    apolloServer: ReturnType<typeof buildApolloServer>;
    userService: CachedUserService;
    serviceCache: Keyv;
    cacheBackend: CacheBackend;
    shutdown: () => Promise<void>;
}

const buildApolloServer = (apolloCache: KeyvAdapter | undefined) =>
    new ApolloServer({
        schema: buildSubgraphSchema({ typeDefs, resolvers: resolvers as any }),
        cache: apolloCache,
        plugins: [ApolloServerPluginCacheControl({ defaultMaxAge: 0 })],
        formatError: formatGraphQLError,
    });

export const composeApp = async (deps: AppDependencies) => {
    const cacheBackend = deps.cacheBackend ?? selectCacheBackend();
    const serviceCache = cacheBackend.create();
    const apolloCache = cacheBackend.supportsApollo ? new KeyvAdapter(serviceCache) : undefined;

    const baseUserService = new UserService(
        deps.prisma,
        deps.passwordHasher ?? passwordHasher,
        deps.tokenService ?? tokenService
    );
    const userService = new CachedUserService(baseUserService, serviceCache);

    const apolloServer = buildApolloServer(apolloCache);
    await apolloServer.start();

    return {
        apolloServer,
        userService,
        serviceCache,
        cacheBackend,
        shutdown: async () => {
            await apolloServer.stop();
            await cacheBackend.disconnect(serviceCache);
        },
    };
};
