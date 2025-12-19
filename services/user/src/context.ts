import { Context as HonoContext } from 'hono';
import { JwtUtils, UserPayload } from './utils/jwt';

export interface GraphQLContext {
    user: UserPayload | null;
}

export const createContext = async (c: HonoContext): Promise<GraphQLContext> => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
        return { user: null };
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return { user: null };
    }

    const user = JwtUtils.verify(token);
    return { user };
};