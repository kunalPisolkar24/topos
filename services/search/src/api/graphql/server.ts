import depthLimit from 'graphql-depth-limit';
import { GraphQLError } from 'graphql';
import { createComplexityRule, simpleEstimator } from 'graphql-query-complexity';
import { ApolloServer, BaseContext } from '@apollo/server';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { typeDefs } from './schema.js';
import { resolvers } from './resolvers.js';
import { formatGraphQLError } from './error-formatter.js';

export interface ApolloServerOptions {
    isProduction: boolean;
    maxDepth?: number;
    maxCost?: number;
    costByField?: Record<string, { complexity: number }>;
}

const defaultCost = (): Record<string, { complexity: number }> => ({
    Query: { complexity: 1 },
    searchPosts: { complexity: 10 },
    Post: { complexity: 1 },
});

export const buildApolloServer = (
    options: ApolloServerOptions
): ApolloServer<BaseContext> => {
    const maxDepth = options.maxDepth ?? 7;
    const maxCost = options.maxCost ?? 1000;
    const costByField = options.costByField ?? defaultCost();

    return new ApolloServer<BaseContext>({
        schema: buildSubgraphSchema({ typeDefs, resolvers: resolvers as any }),
        introspection: !options.isProduction,
        validationRules: [
            depthLimit(maxDepth) as any,
            createComplexityRule({
                maximumComplexity: maxCost,
                createError: (max: number, actual: number) =>
                    new GraphQLError(
                        `Query is too complex: ${actual}. Maximum allowed complexity: ${max}`
                    ),
                estimators: [
                    (args: { field: { name: string } }) => {
                        const cfg = costByField[args.field.name];
                        return cfg?.complexity ?? 1;
                    },
                    simpleEstimator({ defaultComplexity: 1 }),
                ],
            }) as any,
        ],
        formatError: formatGraphQLError({ isProduction: options.isProduction }),
    });
};
