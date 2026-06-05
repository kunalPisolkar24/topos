import { describe, it, expect, beforeEach } from 'vitest';
import {
    buildConfig,
    getApiConfig,
    getSharedConfig,
    getWorkerConfig,
    resetConfigCache,
    ConfigValidationError,
} from './index.js';

const baseEnv: NodeJS.ProcessEnv = {
    ELASTICSEARCH_URL: 'http://localhost:9200',
    REDIS_URL: 'redis://localhost:6379',
};

describe('buildConfig', () => {
    beforeEach(() => {
        resetConfigCache();
    });

    describe('required fields and defaults', () => {
        it('returns a config with elasticsearch defaults', () => {
            const config = buildConfig(baseEnv);

            expect(config.elasticsearch.url).toBe('http://localhost:9200');
            expect(config.elasticsearch.index).toBe('posts');
            expect(config.elasticsearch.tlsRejectUnauthorized).toBe(true);
            expect(config.elasticsearch.refreshPolicy).toBe('wait_for');
            expect(config.elasticsearch.requestTimeoutMs).toBe(30000);
            expect(config.elasticsearch.maxRetries).toBe(3);
            expect(config.elasticsearch.bulkChunkSize).toBe(1000);
        });

        it('falls back to info level in production and debug otherwise', () => {
            expect(buildConfig({ ...baseEnv, NODE_ENV: 'production' }).logging.level).toBe(
                'info'
            );
            expect(buildConfig({ ...baseEnv, NODE_ENV: 'development' }).logging.level).toBe(
                'debug'
            );
        });

        it('honours explicit LOG_LEVEL', () => {
            expect(
                buildConfig({ ...baseEnv, LOG_LEVEL: 'warn' }).logging.level
            ).toBe('warn');
        });

        it('uses service defaults', () => {
            const config = buildConfig(baseEnv);
            expect(config.service.name).toBe('search-service');
            expect(config.service.version).toBe('0.0.0');
            expect(config.service.env).toBe('development');
        });
    });

    describe('auth', () => {
        it('defaults to disabled with RS256 and 600s cache', () => {
            const config = buildConfig(baseEnv);
            expect(config.auth.enabled).toBe(false);
            expect(config.auth.algorithms).toEqual(['RS256']);
            expect(config.auth.cacheMaxAgeMs).toBe(600000);
            expect(config.auth.clockToleranceSec).toBe(5);
        });

        it('requires AUTH_JWKS_URI when AUTH_ENABLED=true', () => {
            try {
                buildConfig({ ...baseEnv, AUTH_ENABLED: 'true' });
                throw new Error('expected throw');
            } catch (err: any) {
                expect(err).toBeInstanceOf(ConfigValidationError);
                expect(JSON.stringify(err.issues)).toMatch(/AUTH_JWKS_URI is required/);
            }
        });

        it('parses algorithm allowlist', () => {
            const config = buildConfig({
                ...baseEnv,
                AUTH_ENABLED: 'true',
                AUTH_JWKS_URI: 'https://idp.test/.well-known/jwks.json',
                AUTH_ALGORITHMS: 'RS256,ES256',
            });
            expect(config.auth.algorithms).toEqual(['RS256', 'ES256']);
        });

        it('rejects unknown algorithm names', () => {
            expect(() =>
                buildConfig({
                    ...baseEnv,
                    AUTH_ENABLED: 'true',
                    AUTH_JWKS_URI: 'https://idp.test/jwks.json',
                    AUTH_ALGORITHMS: 'RS256,XYZ',
                })
            ).toThrow(/AUTH_ALGORITHMS/);
        });

        it('parses audience, issuer, and tolerances', () => {
            const config = buildConfig({
                ...baseEnv,
                AUTH_ENABLED: 'true',
                AUTH_JWKS_URI: 'https://idp.test/jwks.json',
                AUTH_AUDIENCE: 'search-api',
                AUTH_ISSUER: 'https://idp.test',
                AUTH_CLOCK_TOLERANCE_SEC: '10',
            });
            expect(config.auth.audience).toBe('search-api');
            expect(config.auth.issuer).toBe('https://idp.test');
            expect(config.auth.clockToleranceSec).toBe(10);
        });
    });

    describe('http', () => {
        it('defaults corsOrigins to empty and trustProxy to false', () => {
            const config = buildConfig(baseEnv);
            expect(config.http.corsOrigins).toEqual([]);
            expect(config.http.trustProxy).toBe(false);
            expect(config.http.bodyLimitKb).toBe(256);
        });

        it('parses CORS_ORIGINS and HTTP_TRUST_PROXY', () => {
            const config = buildConfig({
                ...baseEnv,
                CORS_ORIGINS: 'https://a.test, https://b.test',
                HTTP_TRUST_PROXY: 'true',
                HTTP_BODY_LIMIT_KB: '512',
            });
            expect(config.http.corsOrigins).toEqual(['https://a.test', 'https://b.test']);
            expect(config.http.trustProxy).toBe(true);
            expect(config.http.bodyLimitKb).toBe(512);
        });
    });

    describe('redis', () => {
        it('accepts a redis url', () => {
            const config = buildConfig({
                ...baseEnv,
                REDIS_URL: 'redis://localhost:6379',
            });
            expect(config.redis.url).toBe('redis://localhost:6379');
            expect(config.redis.sentinelHosts).toBeUndefined();
        });

        it('parses sentinel hosts with port', () => {
            const config = buildConfig({
                ...baseEnv,
                REDIS_SENTINEL_HOSTS: 'h1:26379,h2:26380',
            });
            expect(config.redis.sentinelHosts).toEqual([
                { host: 'h1', port: 26379 },
                { host: 'h2', port: 26380 },
            ]);
        });

        it('rejects an invalid sentinel host entry', () => {
            expect(() =>
                buildConfig({ ...baseEnv, REDIS_SENTINEL_HOSTS: 'h1:notaport' })
            ).toThrow(ConfigValidationError);
        });

        it('rejects when neither url nor sentinel hosts are provided', () => {
            expect(() => buildConfig({ ELASTICSEARCH_URL: 'http://localhost:9200' })).toThrow(
                ConfigValidationError
            );
        });
    });

    describe('kafka', () => {
        it('populates kafka block when KAFKA_BROKER is set', () => {
            const config = buildConfig({
                ...baseEnv,
                REDIS_URL: 'redis://localhost:6379',
                KAFKA_BROKER: 'k1:9092,k2:9092',
                KAFKA_GROUP_ID: 'g1',
            });
            expect(config.kafka).toBeDefined();
            expect(config.kafka!.brokers).toEqual(['k1:9092', 'k2:9092']);
            expect(config.kafka!.groupId).toBe('g1');
            expect(config.kafka!.fromBeginning).toBe(false);
            expect(config.kafka!.partitionsConcurrent).toBe(3);
            expect(config.kafka!.sessionTimeoutMs).toBe(30000);
            expect(config.kafka!.heartbeatIntervalMs).toBe(3000);
            expect(config.kafka!.topicPosts).toBe('posts');
            expect(config.kafka!.topicDlq).toBe('posts.dlq');
        });

        it('omits kafka block when KAFKA_BROKER is not set', () => {
            const config = buildConfig({ ...baseEnv, REDIS_URL: 'redis://localhost:6379' });
            expect(config.kafka).toBeUndefined();
        });

        it('honours KAFKA_FROM_BEGINNING=true', () => {
            const config = buildConfig({
                ...baseEnv,
                REDIS_URL: 'redis://localhost:6379',
                KAFKA_BROKER: 'k1:9092',
                KAFKA_FROM_BEGINNING: 'true',
            });
            expect(config.kafka!.fromBeginning).toBe(true);
        });
    });

    describe('api/worker flags', () => {
        it('flags api when API_PORT is set', () => {
            const config = buildConfig({ ...baseEnv, REDIS_URL: 'redis://x', API_PORT: '4003' });
            expect(config.api).toEqual({ port: 4003 });
        });

        it('falls back to PORT when API_PORT is missing', () => {
            const config = buildConfig({ ...baseEnv, REDIS_URL: 'redis://x', PORT: '4004' });
            expect(config.api).toEqual({ port: 4004 });
        });

        it('flags worker only when KAFKA_BROKER is set', () => {
            const api = buildConfig({ ...baseEnv, REDIS_URL: 'redis://x', API_PORT: '4003' });
            expect(api.worker).toBeUndefined();
            const worker = buildConfig({
                ...baseEnv,
                REDIS_URL: 'redis://x',
                KAFKA_BROKER: 'k1:9092',
            });
            expect(worker.worker).toEqual({ metricsPort: 7091 });
        });
    });

    describe('cors, auth, metrics, http', () => {
        it('parses CORS_ORIGINS', () => {
            const config = buildConfig({
                ...baseEnv,
                REDIS_URL: 'redis://x',
                CORS_ORIGINS: 'https://a, https://b',
            });
            expect(config.http.corsOrigins).toEqual(['https://a', 'https://b']);
        });

        it('parses METRICS_BASIC_AUTH', () => {
            const config = buildConfig({
                ...baseEnv,
                REDIS_URL: 'redis://x',
                METRICS_BASIC_AUTH: 'admin:secret',
            });
            expect(config.metrics.basicAuth).toEqual({ username: 'admin', password: 'secret' });
        });

        it('rejects malformed METRICS_BASIC_AUTH', () => {
            expect(() =>
                buildConfig({
                    ...baseEnv,
                    REDIS_URL: 'redis://x',
                    METRICS_BASIC_AUTH: 'no-colon',
                })
            ).toThrow(ConfigValidationError);
        });

        it('AUTH_ENABLED toggles config.auth.enabled', () => {
            expect(
                buildConfig({
                    ...baseEnv,
                    REDIS_URL: 'redis://x',
                    AUTH_ENABLED: 'true',
                    AUTH_JWKS_URI: 'https://idp.test/jwks.json',
                }).auth.enabled
            ).toBe(true);
        });
    });

    describe('get*Config helpers', () => {
        const originalEnv = { ...process.env };

        beforeEach(() => {
            for (const key of Object.keys(process.env)) delete (process.env as any)[key];
            Object.assign(process.env, originalEnv);
        });

        it('getSharedConfig returns the same instance on repeated calls', () => {
            process.env.ELASTICSEARCH_URL = 'http://localhost:9200';
            process.env.REDIS_URL = 'redis://localhost:6379';
            const a = getSharedConfig();
            const b = getSharedConfig();
            expect(a).toBe(b);
        });

        it('getApiConfig requires API_PORT or PORT', () => {
            process.env.ELASTICSEARCH_URL = 'http://localhost:9200';
            process.env.REDIS_URL = 'redis://localhost:6379';
            resetConfigCache();
            expect(() => getApiConfig()).toThrow(ConfigValidationError);
        });

        it('getWorkerConfig requires KAFKA_BROKER', () => {
            process.env.ELASTICSEARCH_URL = 'http://localhost:9200';
            process.env.REDIS_URL = 'redis://localhost:6379';
            resetConfigCache();
            expect(() => getWorkerConfig()).toThrow(ConfigValidationError);
        });
    });
});
