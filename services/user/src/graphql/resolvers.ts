import { GraphQLContext } from '../context';
import { signupSchema, signinSchema, updateProfileSchema } from '../types';

export const resolvers = {
    Query: {
        me: async (_: unknown, __: unknown, context: GraphQLContext) => {
            if (!context.user) return null;
            return context.loaders.user.load(context.user.id);
        },
        user: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
            return context.loaders.user.load(parseInt(id));
        },
        users: async (_: unknown, { limit, cursor }: { limit: number; cursor?: string }, context: GraphQLContext) => {
            return context.userService.findAll({
                limit: Math.min(limit, 50),
                cursor: cursor ? parseInt(cursor) : undefined
            });
        }
    },
    Mutation: {
        signup: async (_: unknown, args: unknown, context: GraphQLContext) => {
            const validated = signupSchema.parse(args);
            return context.userService.signup(validated);
        },
        signin: async (_: unknown, args: unknown, context: GraphQLContext) => {
            const validated = signinSchema.parse(args);
            return context.userService.signin(validated);
        },
        updateProfile: async (_: unknown, args: unknown, context: GraphQLContext) => {
            if (!context.user) {
                throw new Error('Unauthorized');
            }
            const validated = updateProfileSchema.parse(args);
            return context.userService.updateProfile(context.user.id, validated);
        }
    },
    User: {
        __resolveReference: async (userRef: { id: string }, context: GraphQLContext) => {
            return context.loaders.user.load(parseInt(userRef.id));
        },
    },
};