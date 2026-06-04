import { Context as HonoContext } from 'hono';
import { Logger } from 'pino';
import { TokenService, UserPayload, tokenService } from './utils/tokenService';
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
    userService: IUserService,
    tokens: TokenService = tokenService
): Promise<GraphQLContext> => {
    const token = extractBearerToken(c.req.header('Authorization'));
    const user = token ? tokens.verify(token) : null;
    const requestId = c.get('requestId') ?? c.req.header('x-request-id') ?? crypto.randomUUID();
    const requestLogger = c.get('requestLogger') ?? baseLogger.child({ requestId });

    return {
        requestId,
        user,
        userService,
        loaders: {
            user: createUserLoader(userService)
        },
        getContextLogger: () => requestLogger,
    };
};
