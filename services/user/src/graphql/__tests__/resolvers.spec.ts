import { describe, it, expect, vi } from 'vitest';
import { resolvers } from '../resolvers.js';
import { UnauthorizedError, UserNotFoundError, ValidationError } from '../../errors.js';
import type { GraphQLContext } from '../../context.js';

type UserServiceLike = GraphQLContext['userService'];

const makeContext = (overrides: Partial<GraphQLContext> = {}): GraphQLContext => ({
  user: null,
  userService: {
    findById: vi.fn(),
    findByIdForReference: vi.fn(),
    findAll: vi.fn(),
    signup: vi.fn(),
    signin: vi.fn(),
    updateProfile: vi.fn(),
  } as unknown as UserServiceLike,
  visibleEmails: new Set<string>(),
  ...overrides,
});

describe('Query.me', () => {
  it('returns null when unauthenticated', () => {
    const ctx = makeContext();

    expect(resolvers.Query.me(null, {}, ctx)).toBeNull();
    expect(ctx.userService.findById).not.toHaveBeenCalled();
  });

  it('returns the current user when authenticated', async () => {
    const ctx = makeContext({ user: { id: 'u1' } });
    vi.mocked(ctx.userService.findById).mockResolvedValue({ id: 'u1' } as never);

    await expect(resolvers.Query.me(null, {}, ctx)).resolves.toEqual({ id: 'u1' });
    expect(ctx.userService.findById).toHaveBeenCalledWith('u1');
  });
});

describe('Query.user', () => {
  it('returns the user when found', async () => {
    const ctx = makeContext();
    vi.mocked(ctx.userService.findById).mockResolvedValue({ id: 'u1' } as never);

    await expect(resolvers.Query.user(null, { id: 'u1' }, ctx)).resolves.toEqual({ id: 'u1' });
  });

  it('throws UserNotFoundError when the user does not exist', async () => {
    const ctx = makeContext();
    vi.mocked(ctx.userService.findById).mockResolvedValue(null);

    await expect(resolvers.Query.user(null, { id: 'u1' }, ctx)).rejects.toBeInstanceOf(
      UserNotFoundError,
    );
  });
});

describe('Query.users', () => {
  it('uses the default limit of 20', async () => {
    const ctx = makeContext();
    vi.mocked(ctx.userService.findAll).mockResolvedValue([]);

    await resolvers.Query.users(null, {}, ctx);

    expect(ctx.userService.findAll).toHaveBeenCalledWith({ limit: 20, cursor: undefined });
  });

  it('clamps the limit to the allowed range', async () => {
    const ctx = makeContext();
    vi.mocked(ctx.userService.findAll).mockResolvedValue([]);

    await resolvers.Query.users(null, { limit: 999 }, ctx);
    await resolvers.Query.users(null, { limit: 0 }, ctx);

    expect(ctx.userService.findAll).toHaveBeenNthCalledWith(1, { limit: 50, cursor: undefined });
    expect(ctx.userService.findAll).toHaveBeenNthCalledWith(2, { limit: 1, cursor: undefined });
  });

  it('floors fractional limits and forwards the cursor', async () => {
    const ctx = makeContext();
    const cursor = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    vi.mocked(ctx.userService.findAll).mockResolvedValue([]);

    await resolvers.Query.users(null, { limit: 10.7, cursor }, ctx);

    expect(ctx.userService.findAll).toHaveBeenCalledWith({ limit: 10, cursor });
  });

  it('accepts a valid uuid cursor', async () => {
    const ctx = makeContext();
    const cursor = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    vi.mocked(ctx.userService.findAll).mockResolvedValue([]);

    await resolvers.Query.users(null, { limit: 20, cursor }, ctx);

    expect(ctx.userService.findAll).toHaveBeenCalledWith({ limit: 20, cursor });
  });

  it('rejects a malformed cursor with a validation error', () => {
    const ctx = makeContext();

    expect(() =>
      resolvers.Query.users(null, { limit: 20, cursor: 'not-a-uuid' }, ctx),
    ).toThrow(ValidationError);
    expect(ctx.userService.findAll).not.toHaveBeenCalled();
  });
});

describe('Mutation.signup', () => {
  it('validates and delegates to the service', async () => {
    const ctx = makeContext();
    const args = { email: 'alice@example.com', username: 'alice', password: 'password-1234' };
    vi.mocked(ctx.userService.signup).mockResolvedValue({ token: 't', user: null } as never);

    await resolvers.Mutation.signup(null, args, ctx);

    expect(ctx.userService.signup).toHaveBeenCalledWith(args);
  });

  it('rejects invalid input', async () => {
    const ctx = makeContext();

    await expect(resolvers.Mutation.signup(null, { email: 'nope' }, ctx)).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(ctx.userService.signup).not.toHaveBeenCalled();
  });
});

describe('Mutation.signin', () => {
  it('validates and delegates to the service', async () => {
    const ctx = makeContext();
    const args = { email: 'alice@example.com', password: 'password-1234' };
    vi.mocked(ctx.userService.signin).mockResolvedValue({ token: 't', user: null } as never);

    await resolvers.Mutation.signin(null, args, ctx);

    expect(ctx.userService.signin).toHaveBeenCalledWith(args);
  });
});

describe('User.email visibility', () => {
  const user = { id: 'u1', email: 'alice@example.com' };

  it('returns the email for freshly signed-up users in the same request', async () => {
    const ctx = makeContext();
    vi.mocked(ctx.userService.signup).mockResolvedValue({
      token: 't',
      user: { ...user },
    } as never);

    const result = (await resolvers.Mutation.signup(
      null,
      { email: user.email, username: 'alice', password: 'password-1234' },
      ctx,
    )) as { user: typeof user };

    expect(resolvers.User.email(result.user, {}, ctx)).toBe(user.email);
  });

  it('returns the email for freshly signed-in users in the same request', async () => {
    const ctx = makeContext();
    vi.mocked(ctx.userService.signin).mockResolvedValue({
      token: 't',
      user: { ...user },
    } as never);

    const result = (await resolvers.Mutation.signin(
      null,
      { email: user.email, password: 'password-1234' },
      ctx,
    )) as { user: typeof user };

    expect(resolvers.User.email(result.user, {}, ctx)).toBe(user.email);
  });

  it('returns the email to the authenticated subject', () => {
    const ctx = makeContext({ user: { id: 'u1' } });

    expect(resolvers.User.email(user, {}, ctx)).toBe(user.email);
  });

  it('hides the email from other users', () => {
    const ctx = makeContext({ user: { id: 'u2' } });

    expect(resolvers.User.email(user, {}, ctx)).toBeNull();
  });

  it('hides the email from unauthenticated requests', () => {
    const ctx = makeContext();

    expect(resolvers.User.email(user, {}, ctx)).toBeNull();
  });
});

describe('Mutation.updateProfile', () => {
  it('throws UnauthorizedError when unauthenticated', () => {
    const ctx = makeContext();

    expect(() => resolvers.Mutation.updateProfile(null, { name: 'Alice' }, ctx)).toThrow(
      UnauthorizedError,
    );
    expect(ctx.userService.updateProfile).not.toHaveBeenCalled();
  });

  it('validates and delegates to the service for the current user', async () => {
    const ctx = makeContext({ user: { id: 'u1' } });
    const args = { name: 'Alice Updated' };
    vi.mocked(ctx.userService.updateProfile).mockResolvedValue({ id: 'u1' } as never);

    await resolvers.Mutation.updateProfile(null, args, ctx);

    expect(ctx.userService.updateProfile).toHaveBeenCalledWith('u1', args);
  });
});

describe('User.__resolveReference', () => {
  it('resolves a federated reference by id', async () => {
    const ctx = makeContext();
    vi.mocked(ctx.userService.findByIdForReference).mockResolvedValue({ id: 'u1' } as never);

    await expect(resolvers.User.__resolveReference({ id: 'u1' }, ctx)).resolves.toEqual({
      id: 'u1',
    });
    expect(ctx.userService.findByIdForReference).toHaveBeenCalledWith('u1');
  });

  it('returns a tombstone for a deleted user', async () => {
    const ctx = makeContext();
    vi.mocked(ctx.userService.findByIdForReference).mockResolvedValue({
      id: 'u1',
      username: 'deleted_user',
      name: 'Deleted User',
    } as never);

    await expect(resolvers.User.__resolveReference({ id: 'u1' }, ctx)).resolves.toEqual({
      id: 'u1',
      username: 'deleted_user',
      name: 'Deleted User',
    });
  });
});

describe('User.email', () => {
  const user = { id: 'u1', email: 'alice@example.com' };

  // graphql-js invokes field resolvers as (parent, args, context).
  it('returns the email to the owning user', () => {
    expect(resolvers.User.email(user, {}, makeContext({ user: { id: 'u1' } }))).toBe(
      'alice@example.com',
    );
  });

  it('returns null to unauthenticated callers', () => {
    expect(resolvers.User.email(user, {}, makeContext())).toBeNull();
  });

  it('returns null to other users', () => {
    expect(resolvers.User.email(user, {}, makeContext({ user: { id: 'u2' } }))).toBeNull();
  });
});