import { UserService } from '../services/user.service';
import { GraphQLContext } from '../context';
import { signupSchema, signinSchema } from '../types';

const userService = new UserService();

export const resolvers = {
    Query: {
        me: async (_: unknown, __: unknown, context: GraphQLContext) => {
            if (!context.user) return null;
            return userService.getMe(context.user.id);
        },
        user: async (_: unknown, { id }: { id: string }) => {
            return userService.findById(parseInt(id));
        },
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
    },
    User: {
        __resolveReference: async (userRef: { id: string }) => {
            return userService.findById(parseInt(userRef.id));
        },
    },
};