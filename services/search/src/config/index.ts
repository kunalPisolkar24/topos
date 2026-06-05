import { z } from 'zod';
import dotenv from 'dotenv';
import type { IConfig } from '../core/interfaces/config.interface.js';

dotenv.config();

const portSchema = z.coerce.number().int().min(1).max(65535);
const positiveIntSchema = z.coerce.number().int().min(0);
const logLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    ELASTICSEARCH_URL: z.string().url(),
    ELASTICSEARCH_INDEX: z.string().default('posts'),
    ES_TLS_REJECT_UNAUTHORIZED: z
        .enum(['true', 'false'])
        .default('true')
        .transform((v) => v === 'true'),
    ES_REFRESH_POLICY: z.enum(['false', 'true', 'wait_for']).default('wait_for'),
    ES_REQUEST_TIMEOUT_MS: positiveIntSchema.default(30000),
    ES_MAX_RETRIES: positiveIntSchema.default(3),
    BULK_CHUNK_SIZE: positiveIntSchema.default(1000),

    REDIS_URL: z.string().optional(),
    REDIS_SENTINEL_HOSTS: z.string().optional(),
    REDIS_MASTER_NAME: z.string().default('mymaster'),
    REDIS_PASSWORD: z.string().optional(),
    REDIS_SENTINEL_PASSWORD: z.string().optional(),
    REDIS_SENTINEL_TLS: z
        .enum(['true', 'false'])
        .default('false')
        .transform((v) => v === 'true'),

    CACHE_DEFAULT_TTL_SECONDS: positiveIntSchema.default(120),
    MAX_QUERY_LENGTH: positiveIntSchema.default(512),

    KAFKA_BROKER: z.string().min(1).optional(),
    KAFKA_CLIENT_ID: z.string().default('search-service'),
    KAFKA_GROUP_ID: z.string().default('search-workers-group'),
    TOPIC_POSTS: z.string().default('posts'),
    TOPIC_DLQ: z.string().default('posts.dlq'),
    KAFKA_FROM_BEGINNING: z
        .enum(['true', 'false'])
        .default('false')
        .transform((v) => v === 'true'),
    KAFKA_PARTITIONS_CONCURRENT: positiveIntSchema.default(3),
    KAFKA_SESSION_TIMEOUT_MS: positiveIntSchema.default(30000),
    KAFKA_HEARTBEAT_INTERVAL_MS: positiveIntSchema.default(3000),

    API_PORT: portSchema.optional(),
    PORT: portSchema.optional(),
    WORKER_METRICS_PORT: portSchema.default(7091),

    CORS_ORIGINS: z.string().default(''),
    AUTH_ENABLED: z
        .enum(['true', 'false'])
        .default('false')
        .transform((v) => v === 'true'),
    METRICS_BASIC_AUTH: z.string().default(''),
    HTTP_BODY_LIMIT_KB: positiveIntSchema.default(256),

    SHUTDOWN_TIMEOUT_MS: positiveIntSchema.default(15000),
    LOG_LEVEL: logLevelSchema.optional(),
    SERVICE_NAME: z.string().default('search-service'),
    SERVICE_VERSION: z.string().default('0.0.0'),
});

const parseSentinelHosts = (raw: string | undefined): Array<{ host: string; port: number }> => {
    if (!raw) return [];
    const entries = raw.split(',').map((s) => s.trim()).filter(Boolean);
    return entries.map((entry) => {
        const idx = entry.lastIndexOf(':');
        if (idx <= 0 || idx === entry.length - 1) {
            throw new Error(`Invalid REDIS_SENTINEL_HOSTS entry: "${entry}". Expected host:port`);
        }
        const host = entry.slice(0, idx).trim();
        const port = Number.parseInt(entry.slice(idx + 1).trim(), 10);
        if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
            throw new Error(`Invalid REDIS_SENTINEL_HOSTS entry: "${entry}". Expected host:port`);
        }
        return { host, port };
    });
};

const parseMetricsBasicAuth = (raw: string): { username: string; password: string } | undefined => {
    if (!raw) return undefined;
    const idx = raw.indexOf(':');
    if (idx <= 0 || idx === raw.length - 1) {
        throw new Error('Invalid METRICS_BASIC_AUTH. Expected username:password');
    }
    return { username: raw.slice(0, idx), password: raw.slice(idx + 1) };
};

const parseCorsOrigins = (raw: string): string[] =>
    raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

export class ConfigValidationError extends Error {
    public readonly issues: unknown;
    constructor(message: string, issues: unknown) {
        super(message);
        this.name = 'ConfigValidationError';
        this.issues = issues;
    }
}

const logBootstrapError = (issues: unknown): void => {
    process.stderr.write(
        `search-service: invalid environment variables\n${JSON.stringify(issues, null, 2)}\n`
    );
};

export const buildConfig = (overrides: NodeJS.ProcessEnv = process.env): IConfig => {
    const parsed = envSchema.safeParse(overrides);
    if (!parsed.success) {
        logBootstrapError(parsed.error.format());
        throw new ConfigValidationError('Invalid environment variables', parsed.error.format());
    }

    const data = parsed.data;

    const sentinelHosts = parseSentinelHosts(data.REDIS_SENTINEL_HOSTS);
    if (!data.REDIS_URL && sentinelHosts.length === 0) {
        logBootstrapError({ REDIS: 'Either REDIS_URL or REDIS_SENTINEL_HOSTS must be provided' });
        throw new ConfigValidationError('Invalid environment variables', {
            REDIS: 'Either REDIS_URL or REDIS_SENTINEL_HOSTS must be provided',
        });
    }

    const metricsBasicAuth = parseMetricsBasicAuth(data.METRICS_BASIC_AUTH);

    const isWorker = data.KAFKA_BROKER !== undefined;
    const isApi = data.API_PORT !== undefined || data.PORT !== undefined;

    const apiPort = data.API_PORT ?? data.PORT;
    const effectiveLogLevel =
        data.LOG_LEVEL ?? (data.NODE_ENV === 'production' ? 'info' : 'debug');

    const config: IConfig = {
        service: {
            name: data.SERVICE_NAME,
            version: data.SERVICE_VERSION,
            env: data.NODE_ENV,
        },
        api: isApi
            ? {
                  port: apiPort ?? 4003,
              }
            : undefined,
        worker: isWorker
            ? {
                  metricsPort: data.WORKER_METRICS_PORT,
              }
            : undefined,
        elasticsearch: {
            url: data.ELASTICSEARCH_URL,
            index: data.ELASTICSEARCH_INDEX,
            tlsRejectUnauthorized: data.ES_TLS_REJECT_UNAUTHORIZED,
            requestTimeoutMs: data.ES_REQUEST_TIMEOUT_MS,
            maxRetries: data.ES_MAX_RETRIES,
            refreshPolicy: data.ES_REFRESH_POLICY,
            bulkChunkSize: data.BULK_CHUNK_SIZE,
        },
        redis: {
            url: data.REDIS_URL,
            sentinelHosts: sentinelHosts.length > 0 ? sentinelHosts : undefined,
            sentinelMasterName: data.REDIS_MASTER_NAME,
            password: data.REDIS_PASSWORD,
            sentinelPassword: data.REDIS_SENTINEL_PASSWORD,
            sentinelTls: data.REDIS_SENTINEL_TLS,
        },
        kafka: data.KAFKA_BROKER
            ? {
                  brokers: data.KAFKA_BROKER.split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  clientId: data.KAFKA_CLIENT_ID,
                  groupId: data.KAFKA_GROUP_ID,
                  topicPosts: data.TOPIC_POSTS,
                  topicDlq: data.TOPIC_DLQ,
                  fromBeginning: data.KAFKA_FROM_BEGINNING,
                  partitionsConcurrent: data.KAFKA_PARTITIONS_CONCURRENT,
                  sessionTimeoutMs: data.KAFKA_SESSION_TIMEOUT_MS,
                  heartbeatIntervalMs: data.KAFKA_HEARTBEAT_INTERVAL_MS,
              }
            : undefined,
        cache: {
            defaultTtlSeconds: data.CACHE_DEFAULT_TTL_SECONDS,
            maxQueryLength: data.MAX_QUERY_LENGTH,
        },
        auth: {
            enabled: data.AUTH_ENABLED,
        },
        metrics: {
            basicAuth: metricsBasicAuth,
        },
        http: {
            corsOrigins: parseCorsOrigins(data.CORS_ORIGINS),
            bodyLimitKb: data.HTTP_BODY_LIMIT_KB,
        },
        shutdown: {
            timeoutMs: data.SHUTDOWN_TIMEOUT_MS,
        },
        logging: {
            level: effectiveLogLevel,
        },
    };

    return config;
};

export type ApiConfig = IConfig & { api: { port: number } };
export type WorkerConfig = IConfig & { worker: { metricsPort: number }; kafka: NonNullable<IConfig['kafka']> };
export type SharedConfig = IConfig;

let sharedConfigCache: SharedConfig | null = null;
let apiConfigCache: ApiConfig | null = null;
let workerConfigCache: WorkerConfig | null = null;

export const getSharedConfig = (): SharedConfig => {
    if (!sharedConfigCache) {
        sharedConfigCache = buildConfig();
    }
    return sharedConfigCache;
};

export const getApiConfig = (): ApiConfig => {
    if (!apiConfigCache) {
        const cfg = buildConfig();
        if (!cfg.api) {
            throw new ConfigValidationError(
                'API config requested but API_PORT/PORT is not set',
                { API_PORT: 'required for API' }
            );
        }
        apiConfigCache = cfg as ApiConfig;
    }
    return apiConfigCache;
};

export const getWorkerConfig = (): WorkerConfig => {
    if (!workerConfigCache) {
        const cfg = buildConfig();
        if (!cfg.worker || !cfg.kafka) {
            throw new ConfigValidationError(
                'Worker config requested but KAFKA_BROKER is not set',
                { KAFKA_BROKER: 'required for worker' }
            );
        }
        workerConfigCache = cfg as WorkerConfig;
    }
    return workerConfigCache;
};

export const resetConfigCache = (): void => {
    sharedConfigCache = null;
    apiConfigCache = null;
    workerConfigCache = null;
};
