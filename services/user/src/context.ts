import { Context as HonoContext } from 'hono';
import { JwtUtils, UserPayload } from './utils/jwt';
import { IUserService } from './services/interfaces/user.service.interface';
import { UserLoader, createUserLoader } from './graphql/loaders/user.loader';

export interface GraphQLContext {
    user: UserPayload | null;
    userService: IUserService;
    loaders: {
        user: UserLoader;
    };
}

export const createContext = async (
    c: HonoContext, 
    userService: IUserService
): Promise<GraphQLContext> => {
    const authHeader = c.req.header('Authorization');
    let user: UserPayload | null = null;

    if (authHeader) {
        const token = authHeader.split(' ')[1];
        if (token) {
            user = JwtUtils.verify(token);
        }
    }

    return {
        user,
        userService,
        loaders: {
            user: createUserLoader(userService)
        }
    };
};