import { describe, it, expect, vi } from 'vitest';
import { GraphQLError, type GraphQLFormattedError } from 'graphql';
import {
  extractRateLimitRetryAfter,
  formatError,
  hasErrors,
  operationName,
  sanitizeOperationName,
} from '../formatError.js';
import { RateLimitedError, ValidationError } from '../../errors.js';

const mocks = vi.hoisted(() => ({
  env: { NODE_ENV: 'test', LOG_LEVEL: 'info' },
}));

vi.mock('../../config/env.js', () => ({ env: mocks.env }));

describe('formatError', () => {
  it('maps a domain error to { message, path, extensions.code }', () => {
    const domain = new ValidationError('cursor must be a valid user id');
    const error = new GraphQLError('unused', { originalError: domain });

    const formatted = formatError(
      { message: 'unused', path: ['users'] },
      error,
    );

    expect(formatted).toEqual({
      message: 'cursor must be a valid user id',
      path: ['users'],
      extensions: { code: 'VALIDATION_ERROR' },
    });
  });

  it('passes through plain GraphQLErrors unchanged', () => {
    const error = new GraphQLError('Cannot query field "x"');
    const formatted: GraphQLFormattedError = { message: 'Cannot query field "x"' };

    expect(formatError(formatted, error)).toBe(formatted);
  });

  it('masks unexpected errors as INTERNAL_ERROR', () => {
    const error = new GraphQLError('boom', { originalError: new Error('boom') });
    const formatted: GraphQLFormattedError = { message: 'boom' };

    const result = formatError(formatted, error);

    expect(result).toEqual({
      message: 'Internal server error',
      extensions: { code: 'INTERNAL_ERROR' },
    });
  });

  it('exposes rate limit metadata for backoff', () => {
    const domain = new RateLimitedError('signin', 2500);
    const error = new GraphQLError('unused', { originalError: domain });

    const formatted = formatError({ message: 'unused', path: ['signin'] }, error);

    expect(formatted).toEqual({
      message: 'Rate limited, retry after 3s',
      path: ['signin'],
      extensions: { code: 'RATE_LIMITED', retryAfterMs: 2500, policy: 'signin' },
    });
  });
});

describe('extractRateLimitRetryAfter', () => {
  it('returns the longest retry delay across rate-limited errors', () => {
    const body = JSON.stringify({
      errors: [
        { extensions: { code: 'RATE_LIMITED', retryAfterMs: 1000 } },
        { extensions: { code: 'RATE_LIMITED', retryAfterMs: 2500 } },
        { extensions: { code: 'INVALID_CREDENTIALS' } },
      ],
    });

    expect(extractRateLimitRetryAfter(body)).toBe(2500);
  });

  it('returns null when nothing is rate limited', () => {
    expect(extractRateLimitRetryAfter('{"data":{}}')).toBeNull();
    expect(
      extractRateLimitRetryAfter('{"errors":[{"extensions":{"code":"INVALID_CREDENTIALS"}}]}'),
    ).toBeNull();
    expect(extractRateLimitRetryAfter('not-json')).toBeNull();
  });
});

describe('hasErrors', () => {
  it('detects an errors array in a response body', () => {
    expect(hasErrors('{"data":null,"errors":[{"message":"x"}]}')).toBe(true);
  });

  it('returns false for error-free or invalid bodies', () => {
    expect(hasErrors('{"data":{}}')).toBe(false);
    expect(hasErrors('not-json')).toBe(false);
  });
});

describe('operationName', () => {
  it('returns the client-supplied operation name', () => {
    expect(operationName({ query: '{ me }', operationName: 'Me' })).toBe('Me');
  });

  it('falls back to anonymous for missing or empty names', () => {
    expect(operationName({ query: '{ me }' })).toBe('anonymous');
    expect(operationName({ query: '{ me }', operationName: '' })).toBe('anonymous');
    expect(operationName('garbage')).toBe('anonymous');
    expect(operationName(null)).toBe('anonymous');
  });
});

describe('sanitizeOperationName', () => {
  it('passes through known operations and anonymous', () => {
    for (const name of ['me', 'user', 'users', 'signup', 'signin', 'updateProfile']) {
      expect(sanitizeOperationName(name)).toBe(name);
    }
    expect(sanitizeOperationName('anonymous')).toBe('anonymous');
  });

  it('buckets arbitrary client-supplied names into unknown', () => {
    expect(sanitizeOperationName('randomName-12345')).toBe('unknown');
    expect(sanitizeOperationName('Me')).toBe('unknown');
    expect(sanitizeOperationName('')).toBe('unknown');
  });
});