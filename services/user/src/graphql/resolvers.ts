import type { GraphQLContext } from '../context.js';
import { RateLimitedError, UnauthorizedError, UserNotFoundError, ValidationError } from '../errors.js';
import { RateLimiter, type RateLimitPolicy } from '../lib/rateLimit.js';
import { signinSchema, signupSchema, updateProfileSchema, validate } from '../schemas.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertValidCursor(cursor: string | null | undefined): void {
  if (cursor !== undefined && cursor !== null && !UUID_PATTERN.test(cursor)) {
    throw new ValidationError('cursor must be a valid user id');
  }
}

function subjectFor(ctx: GraphQLContext): string {
  return RateLimiter.subjectFor(ctx.user?.id ?? null, ctx.clientIp);
}

// Checks one quota unit before the resolver runs. A null limiter (tests,
// tooling) disables checks so existing callers keep working unchanged.
async function checkRateLimit(ctx: GraphQLContext, policy: RateLimitPolicy): Promise<void> {
  const limiter = ctx.rateLimiter;
  if (!limiter) {
    return;
  }
  const decision = await limiter.check(policy, subjectFor(ctx));
  if (!decision.allowed) {
    throw new RateLimitedError(policy, decision.retryAfterMs);
  }
}

// Guards the bcrypt path: quota plus one concurrency slot held for the
// service call. Returns the release function, invoked in a finally by
// the caller. The quota check runs before validation and bcrypt so a
// flood is rejected before burning CPU.
async function guardAuth(ctx: GraphQLContext, policy: 'signup' | 'signin'): Promise<() => void> {
  const limiter = ctx.rateLimiter;
  if (!limiter) {
    return () => {};
  }
  const { decision, release } = await limiter.guardAuth(policy, subjectFor(ctx));
  if (!decision.allowed) {
    throw new RateLimitedError(policy, decision.retryAfterMs);
  }
  return release ?? (() => {});
}

export const resolvers = {
  Query: {
    me: async (_: unknown, __: unknown, ctx: GraphQLContext) => {
      await checkRateLimit(ctx, 'reads');
      return ctx.user ? ctx.userService.findById(ctx.user.id) : null;
    },
    user: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      await checkRateLimit(ctx, 'reads');
      const user = await ctx.userService.findById(id);
      if (!user) {
        throw new UserNotFoundError();
      }
      return user;
    },
    users: async (
      _: unknown,
      { limit = 20, cursor }: { limit?: number; cursor?: string | null },
      ctx: GraphQLContext,
    ) => {
      await checkRateLimit(ctx, 'reads');
      assertValidCursor(cursor);
      return ctx.userService.findAll({
        limit: Math.min(Math.max(Math.floor(limit), 1), 50),
        cursor: cursor ?? undefined,
      });
    },
  },
  Mutation: {
    signup: async (_: unknown, args: unknown, ctx: GraphQLContext) => {
      const release = await guardAuth(ctx, 'signup');
      try {
        const result = await ctx.userService.signup(validate(signupSchema, args));
        // Unauthenticated by construction, but the subject just proved
        // ownership via credentials: its own email stays visible below.
        if (result.user) {
          ctx.visibleEmails.add(result.user.id);
        }
        return result;
      } finally {
        release();
      }
    },
    signin: async (_: unknown, args: unknown, ctx: GraphQLContext) => {
      const release = await guardAuth(ctx, 'signin');
      try {
        const result = await ctx.userService.signin(validate(signinSchema, args));
        if (result.user) {
          ctx.visibleEmails.add(result.user.id);
        }
        return result;
      } finally {
        release();
      }
    },
    updateProfile: async (_: unknown, args: unknown, ctx: GraphQLContext) => {
      if (!ctx.user) {
        throw new UnauthorizedError();
      }
      await checkRateLimit(ctx, 'mutations');
      return ctx.userService.updateProfile(ctx.user.id, validate(updateProfileSchema, args));
    },
  },
  User: {
    __resolveReference: (ref: { id: string }, ctx: GraphQLContext) =>
      ctx.userService.findByIdForReference(ref.id),
    // Emails stay private: visible to the subject (authenticated, or fresh
    // from signup/signin in this request) and hidden from everyone else.
    // NOTE: graphql-js calls field resolvers as (parent, args, context),
    // so context is the THIRD parameter, not the second.
    email: (
      obj: { id: string; email: string | null },
      _args: unknown,
      ctx: GraphQLContext,
    ) => (ctx.user?.id === obj.id || ctx.visibleEmails.has(obj.id) ? obj.email : null),
  },
};
