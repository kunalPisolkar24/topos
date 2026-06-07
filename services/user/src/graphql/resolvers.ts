import { GraphQLContext } from '../context';
import { signupSchema, signinSchema, updateProfileSchema } from '../types';
import { ValidationError, UnauthorizedError } from '../errors/DomainError';

const USERS_LIMIT_FLOOR = 1;
const USERS_LIMIT_CEIL = 50;
const USERS_DEFAULT_LIMIT = 20;
const CURSOR_PATTERN = /^\d+$/;

export const resolvers = {
    Query: {
        me: async (_: unknown, __: unknown, context: GraphQLContext) => {
            if (!context.user) return null;
            return context.loaders.user.load(context.user.id);
        },
        user: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
            return context.loaders.user.load(parseInt(id));
        },
        users: async (_: unknown, { limit, cursor }: { limit?: number; cursor?: string }, context: GraphQLContext) => {
            const safeLimit = Number.isFinite(limit) && (limit as number) >= USERS_LIMIT_FLOOR
                ? Math.min(limit as number, USERS_LIMIT_CEIL)
                : USERS_DEFAULT_LIMIT;
            let safeCursor: number | undefined;
            if (cursor !== undefined && cursor !== null) {
                if (typeof cursor !== 'string' || !CURSOR_PATTERN.test(cursor)) {
                    throw new ValidationError('Cursor must be a numeric string');
                }
                safeCursor = parseInt(cursor, 10);
            }
            return context.userService.findAll({ limit: safeLimit, cursor: safeCursor });
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
                throw new UnauthorizedError();
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