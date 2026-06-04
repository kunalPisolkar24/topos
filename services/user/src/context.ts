import { Context as HonoContext } from 'hono';
import { Logger } from 'pino';
import { JwtUtils, UserPayload } from './utils/jwt';
import { extractBearerToken } from './utils/authHeader';
import { IUserService } from './services/interfaces/user.service.interface';
import { UserLoader, createUserLoader } from './graphql/loaders/user.loader';
import { logger as baseLogger } from './lib/logger';

export interface GraphQLContext {
    requestId: string;
    user: UserPayload | null;
    userService: IUserService;
    loaders: {
        user: UserLoader;
    };
    getContextLogger(): Logger;
}

export const createContext = async (
    c: HonoContext,
    userService: IUserService
): Promise<GraphQLContext> => {
    const token = extractBearerToken(c.req.header('Authorization'));
    const user = token ? JwtUtils.verify(token) : null;
    const requestId = c.get('requestId') ?? c.req.header('x-request-id') ?? crypto.randomUUID();
    const contextLogger = baseLogger.child({ requestId });

    return {
        requestId,
        user,
        userService,
        loaders: {
            user: createUserLoader(userService)
        },
        getContextLogger: () => contextLogger,
    };
};
