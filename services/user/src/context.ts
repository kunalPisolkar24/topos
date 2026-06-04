import { Context as HonoContext } from 'hono';
import { JwtUtils, UserPayload } from './utils/jwt';
import { extractBearerToken } from './utils/authHeader';
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
    const token = extractBearerToken(c.req.header('Authorization'));
    const user = token ? JwtUtils.verify(token) : null;

    return {
        user,
        userService,
        loaders: {
            user: createUserLoader(userService)
        }
    };
};
