import type { Context as HonoContext } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';
import type { RateLimiter } from './lib/rateLimit.js';
import { clientIpFromHeaders } from './lib/rateLimit.js';
import type { UserService } from './user.service.js';
import { verifyToken } from './utils/token.js';

export interface GraphQLContext {
  user: { id: string } | null;
  userService: UserService;
  // Quota guard for this request (null disables checks, e.g. in tests).
  rateLimiter: RateLimiter | null;
  // Caller IP for anonymous quota keys, resolved at context creation.
  clientIp: string;
  // User ids whose email the Email field resolver may return in this
  // request. Populated by signup/signin (unauthenticated by construction,
  // but the subject proved ownership via credentials). Fresh per request.
  visibleEmails: Set<string>;
}

export async function createContext(
  c: HonoContext,
  userService: UserService,
  rateLimiter: RateLimiter | null = null,
): Promise<GraphQLContext> {
  const header = c.req.header('authorization');
  const token = header?.match(/^Bearer\s+(\S+)$/i)?.[1];
  return {
    user: token ? await verifyToken(token) : null,
    userService,
    rateLimiter,
    clientIp: resolveClientIp(c),
    visibleEmails: new Set(),
  };
}

function resolveClientIp(c: HonoContext): string {
  const headers = {
    get: (name: string): string | null => c.req.header(name) ?? null,
  };
  let remoteAddr: string | undefined;
  try {
    const info = getConnInfo(c);
    const address = (info.remote as { address?: unknown } | undefined)?.address;
    if (typeof address === 'string' && address) {
      remoteAddr = address;
    }
  } catch {
    // No connection info (e.g. in tests); headers or unknown apply.
  }
  return clientIpFromHeaders(headers, remoteAddr);
}
