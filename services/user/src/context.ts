import { Context as HonoContext } from 'hono';
import { Logger } from 'pino';
import { TokenService, UserPayload, tokenService } from './utils/tokenService';
import { extractBearerToken } from './utils/authHeader';
import { IUserService } from './services/interfaces/user.service.interface';
import { UserLoader, createUserLoader } from './graphql/loaders/user.loader';
import { logger as baseLogger } from './lib/logger';

export type OperationKind = 'query' | 'mutation' | 'subscription' | 'unknown';

export interface GraphQLContext {
    requestId: string;
    operationName: string;
    operationKind: OperationKind;
    user: UserPayload | null;
    userService: IUserService;
    loaders: {
        user: UserLoader;
    };
    getContextLogger(): Logger;
}

export interface CreateContextInput {
    operationName: string;
    operationKind: OperationKind;
}

export const createContext = async (
    c: HonoContext,
    userService: IUserService,
    operation: CreateContextInput = { operationName: 'anonymous', operationKind: 'unknown' },
    tokens: TokenService = tokenService
): Promise<GraphQLContext> => {
    const token = extractBearerToken(c.req.header('Authorization'));
    const user = token ? tokens.verify(token) : null;
    const requestId = c.get('requestId') ?? c.req.header('x-request-id') ?? crypto.randomUUID();
    const requestLogger =
        c.get('requestLogger') ??
        baseLogger.child({ requestId, operation: operation.operationName });

    return {
        requestId,
        operationName: operation.operationName,
        operationKind: operation.operationKind,
        user,
        userService,
        loaders: {
            user: createUserLoader(userService),
        },
        getContextLogger: () => requestLogger,
    };
};
