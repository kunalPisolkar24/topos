import { UserService } from '../services/user.service';
import { GraphQLContext } from '../context';
import { signupSchema, signinSchema, updateProfileSchema } from '../types';
import prisma from '../lib/prisma';

const userService = new UserService(prisma);

export const resolvers = {
    Query: {
        me: async (_: unknown, __: unknown, context: GraphQLContext) => {
            if (!context.user) return null;
            return userService.getMe(context.user.id);
        },
        user: async (_: unknown, { id }: { id: string }) => {
            return userService.findById(parseInt(id));
        },
        users: async () => {
            return userService.findAll();
        }
    },
    Mutation: {
        signup: async (_: unknown, args: unknown) => {
            const validated = signupSchema.parse(args);
            return userService.signup(validated);
        },
        signin: async (_: unknown, args: unknown) => {
            const validated = signinSchema.parse(args);
            return userService.signin(validated);
        },
        updateProfile: async (_: unknown, args: unknown, context: GraphQLContext) => {
            if (!context.user) {
                throw new Error('Unauthorized');
            }
            const validated = updateProfileSchema.parse(args);
            return userService.updateProfile(context.user.id, validated);
        }
    },
    User: {
        __resolveReference: async (userRef: { id: string }) => {
            return userService.findById(parseInt(userRef.id));
        },
    },
};