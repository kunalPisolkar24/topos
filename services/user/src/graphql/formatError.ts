import { GraphQLError, type GraphQLFormattedError } from 'graphql';
import { DomainError, RateLimitedError } from '../errors.js';
import { logger } from '../observability/logger.js';

export function hasErrors(body: string): boolean {
  try {
    return Array.isArray(JSON.parse(body).errors);
  } catch {
    return false;
  }
}

export function operationName(body: unknown): string {
  if (
    body !== null &&
    typeof body === 'object' &&
    'operationName' in body &&
    typeof body.operationName === 'string' &&
    body.operationName.length > 0
  ) {
    return body.operationName;
  }
  return 'anonymous';
}

const KNOWN_OPERATIONS = new Set(['me', 'user', 'users', 'signup', 'signin', 'updateProfile']);

export function sanitizeOperationName(name: string): string {
  return name === 'anonymous' || KNOWN_OPERATIONS.has(name) ? name : 'unknown';
}

export function unwrapDomain(error: unknown): DomainError | null {
  const inner =
    error instanceof Error && 'originalError' in error
      ? (error as { originalError?: unknown }).originalError
      : error;
  return inner instanceof DomainError ? inner : null;
}

export function extractErrorCodes(body: string): string[] {
  try {
    const parsed = JSON.parse(body) as { errors?: Array<{ extensions?: { code?: string } }> };
    if (!Array.isArray(parsed.errors)) {
      return [];
    }
    return parsed.errors.map((error) => error?.extensions?.code ?? 'UNKNOWN');
  } catch {
    return [];
  }
}

// Returns the longest retry delay across rate-limited errors in a
// GraphQL response body, or null when no error is rate limited.
export function extractRateLimitRetryAfter(body: string): number | null {
  try {
    const parsed = JSON.parse(body) as {
      errors?: Array<{ extensions?: { code?: string; retryAfterMs?: unknown } }>;
    };
    if (!Array.isArray(parsed.errors)) {
      return null;
    }
    let longest: number | null = null;
    for (const error of parsed.errors) {
      if (error?.extensions?.code === 'RATE_LIMITED') {
        const retryAfterMs = Number(error.extensions.retryAfterMs);
        if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
          longest = longest === null ? retryAfterMs : Math.max(longest, retryAfterMs);
        } else if (longest === null) {
          longest = 1000;
        }
      }
    }
    return longest;
  } catch {
    return null;
  }
}

export function formatError(
  formatted: GraphQLFormattedError,
  error: unknown,
): GraphQLFormattedError {
  const domain = unwrapDomain(error);
  if (domain instanceof RateLimitedError) {
    return {
      message: domain.message,
      path: formatted.path,
      extensions: { code: domain.code, retryAfterMs: domain.retryAfterMs, policy: domain.policy },
    };
  }
  if (domain) {
    return {
      message: domain.message,
      path: formatted.path,
      extensions: { code: domain.code },
    };
  }
  if (error instanceof GraphQLError && error.originalError === undefined) {
    return formatted;
  }
  logger.error(
    {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    },
    'internal graphql error',
  );
  return { message: 'Internal server error', extensions: { code: 'INTERNAL_ERROR' } };
}