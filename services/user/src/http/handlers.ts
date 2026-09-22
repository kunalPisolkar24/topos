import { ApolloServer, HeaderMap } from '@apollo/server';
import type { MiddlewareHandler } from 'hono';
import { createContext } from '../context.js';
import { GraphqlTimeoutError, PayloadTooLargeError, ValidationError } from '../errors.js';
import {
  extractErrorCodes,
  hasErrors,
  operationName,
  sanitizeOperationName,
} from '../graphql/formatError.js';
import { type Metrics } from '../observability/metrics.js';
import { isShuttingDown } from '../lib/shutdownState.js';
import type { UserService } from '../user.service.js';

const MAX_GRAPHQL_BODY_BYTES = 256 * 1024;
const GRAPHQL_OPERATION_TIMEOUT_MS = 10_000;

function withTimeout<T>(op: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new GraphqlTimeoutError()), ms);
    op.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function timedPing(
  ping: () => Promise<'ok' | 'unavailable'>,
  dep: 'db' | 'redis',
  metrics?: Metrics,
): Promise<'ok' | 'unavailable'> {
  const start = performance.now();
  const result = await ping();
  if (metrics) metrics.recordDependencyPing(dep, (performance.now() - start) / 1000, result === 'ok');
  return result;
}

async function readJsonBody(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_GRAPHQL_BODY_BYTES) {
    throw new PayloadTooLargeError();
  }

  const body = request.body;
  if (!body) {
    throw new ValidationError('Request body must be valid JSON');
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      total += value.byteLength;
      if (total > MAX_GRAPHQL_BODY_BYTES) {
        throw new PayloadTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new ValidationError('Request body must be valid JSON');
  }
}

export interface GraphqlHandlerDeps {
  apollo: ApolloServer;
  userService: UserService;
  metrics: Metrics;
  timeoutMs?: number;
}

export function graphqlHandler({
  apollo,
  userService,
  metrics,
  timeoutMs = GRAPHQL_OPERATION_TIMEOUT_MS,
}: GraphqlHandlerDeps): MiddlewareHandler {
  return async (c) => {
    const body = await readJsonBody(c.req.raw);
    const operation = sanitizeOperationName(operationName(body));
    const start = performance.now();
    try {
      const response = await withTimeout(
        apollo.executeHTTPGraphQLRequest({
          httpGraphQLRequest: {
            method: c.req.method,
            headers: new HeaderMap(c.req.raw.headers),
            search: new URL(c.req.url).search,
            body,
          },
          context: () => createContext(c, userService),
        }),
        timeoutMs,
      );
      const hasBodyErrors =
        response.body.kind === 'complete' && hasErrors(response.body.string);
      metrics.recordGraphqlOperation(
        operation,
        hasBodyErrors ? 'error' : 'success',
        (performance.now() - start) / 1000,
      );
      if (response.body.kind === 'complete' && hasBodyErrors) {
        for (const code of extractErrorCodes(response.body.string)) {
          metrics.recordGraphqlError(operation, code);
        }
      }

      return new Response(response.body.kind === 'complete' ? response.body.string : null, {
        status: response.status ?? 200,
        headers: Object.fromEntries(response.headers),
      });
    } catch (error) {
      if (error instanceof GraphqlTimeoutError) {
        metrics.recordGraphqlOperation(operation, 'error', (performance.now() - start) / 1000);
        metrics.recordGraphqlError(operation, error.code);
      }
      throw error;
    }
  };
}

export interface HealthPings {
  pingDb: () => Promise<'ok' | 'unavailable'>;
  pingRedis: () => Promise<'ok' | 'unavailable'>;
  metrics?: Metrics;
}

export function healthHandler({ pingDb, pingRedis, metrics }: HealthPings): MiddlewareHandler {
  return async (c) => {
    if (isShuttingDown) {
      metrics?.recordProbeCheck('liveness', 'shutting_down');
      return c.json({ status: 'shutting_down', db: 'unavailable', redis: 'unavailable' }, 503);
    }
    const [db, redis] = await Promise.all([
      timedPing(pingDb, 'db', metrics),
      timedPing(pingRedis, 'redis', metrics),
    ]);
    metrics?.recordProbeCheck('liveness', 'ok');
    return c.json({ status: 'ok', db, redis });
  };
}

export function healthzHandler(metrics?: Metrics): MiddlewareHandler {
  return async (c) => {
    if (isShuttingDown) {
      metrics?.recordProbeCheck('liveness', 'shutting_down');
      return c.json({ status: 'shutting_down' }, 503);
    }
    metrics?.recordProbeCheck('liveness', 'ok');
    return c.json({ status: 'ok' });
  };
}

export interface ReadyPings {
  pingDb: () => Promise<'ok' | 'unavailable'>;
  pingRedis?: () => Promise<'ok' | 'unavailable'>;
  metrics?: Metrics;
}

export function readyHandler(pings: ReadyPings): MiddlewareHandler {
  return readyzHandler(pings);
}

export function readyzHandler({ pingDb, pingRedis, metrics }: ReadyPings): MiddlewareHandler {
  return async (c) => {
    if (isShuttingDown) {
      metrics?.recordProbeCheck('readiness', 'shutting_down');
      return c.json({ status: 'shutting_down', db: 'unavailable', redis: 'unavailable' }, 503);
    }
    const [db, redis] = await Promise.all([
      timedPing(pingDb, 'db', metrics),
      pingRedis ? timedPing(pingRedis, 'redis', metrics) : Promise.resolve<'ok' | 'unavailable'>('ok'),
    ]);
    if (db !== 'ok') {
      metrics?.recordProbeCheck('readiness', 'degraded');
      return c.json({ status: 'degraded', db, redis }, 503);
    }
    metrics?.recordProbeCheck('readiness', 'ok');
    return c.json({ status: 'ok', db: 'ok', redis });
  };
}

export function metricsHandler(metrics: Metrics): MiddlewareHandler {
  return async (c) =>
    c.body(await metrics.getMetrics(), 200, { 'Content-Type': metrics.getContentType() });
}