import depthLimit from 'graphql-depth-limit';
import { ApolloServer, BaseContext } from '@apollo/server';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { typeDefs } from './schema.js';
import { resolvers } from './resolvers.js';
import { formatGraphQLError } from './error-formatter.js';

export interface ApolloServerOptions {
    isProduction: boolean;
    maxDepth?: number;
}

export const buildApolloServer = (
    options: ApolloServerOptions
): ApolloServer<BaseContext> => {
    const maxDepth = options.maxDepth ?? 7;

    return new ApolloServer<BaseContext>({
        schema: buildSubgraphSchema({
            typeDefs,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            resolvers: resolvers as any,
        }),
        introspection: !options.isProduction,
        validationRules: [
            // graphql-depth-limit and @apollo/server disagree on the ValidationRule type signature
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            depthLimit(maxDepth) as any,
        ],
        formatError: formatGraphQLError({ isProduction: options.isProduction }),
    });
};
