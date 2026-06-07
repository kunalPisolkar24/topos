import { expressMiddleware } from '@as-integrations/express5';
import express, { Request, Response } from 'express';
import http from 'http';
import { buildApolloServer } from './api/graphql/server.js';
import { PinoLogger } from './infrastructure/logger/pino.logger.js';
import { ElasticsearchRepository } from './infrastructure/elasticsearch/elasticsearch.repository.js';
import { RedisCache } from './infrastructure/redis/redis.cache.js';
import { PrometheusMetrics } from './infrastructure/monitoring/prometheus.metrics.js';
import { SearchService } from './api/services/search.service.js';
import { buildConfig, ConfigValidationError } from './config/index.js';
import { runShutdown, ShutdownStep } from './utils/shutdown.util.js';
import { JwksAuthVerifier } from './infrastructure/auth/jwks-auth-verifier.js';
import { IAuthVerifier } from './core/interfaces/auth.interface.js';
import { requestId } from './api/middleware/request-id.middleware.js';
import { securityHeaders } from './api/middleware/security-headers.middleware.js';
import { corsMiddleware } from './api/middleware/cors.middleware.js';
import { authMiddleware } from './api/middleware/auth.middleware.js';
import { basicAuth } from './api/middleware/basic-auth.middleware.js';
import { liveness, readiness } from './api/middleware/health.middleware.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;
let httpServer: http.Server | null = null;
let cache: RedisCache | null = null;
let loggerRef: PinoLogger | null = null;

const shutdown = async (signal: string): Promise<void> => {
    if (!loggerRef) {
        process.exit(0);
    }
    loggerRef.info(`Received ${signal}, shutting down`);
    const steps: ShutdownStep[] = [
        {
            name: 'httpServer.close',
            run: async () => {
                if (httpServer) {
                    await new Promise<void>((resolve) => httpServer!.close(() => resolve()));
                }
            },
        },
        {
            name: 'cache.disconnect',
            run: async () => {
                if (cache) await cache.disconnect();
            },
        },
    ];
    await runShutdown(steps, loggerRef, SHUTDOWN_TIMEOUT_MS);
    process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
    if (loggerRef) {
        loggerRef.error('Unhandled promise rejection', { reason: String(reason) });
    }
});
process.on('uncaughtException', (err) => {
    if (loggerRef) {
        loggerRef.error('Uncaught exception', { error: err.message, stack: err.stack });
    }
});

const start = async () => {
    let config;
    try {
        config = buildConfig();
    } catch (err) {
        if (err instanceof ConfigValidationError) {
            console.error('Invalid configuration:', err.message, err.issues);
            process.exit(1);
        }
        throw err;
    }

    if (!config.api) {
        console.error('API_PORT or PORT must be set to run the API');
        process.exit(1);
    }

    const isProduction = config.service.env === 'production';
    const app = express();
    if (config.http.trustProxy) {
        app.set('trust proxy', true);
    }
    httpServer = http.createServer(app);
    const logger = new PinoLogger({
        service: config.service,
        logging: config.logging,
    });
    loggerRef = logger;
    const metrics = new PrometheusMetrics();

    const esRepo = new ElasticsearchRepository(config.elasticsearch, logger, metrics);
    cache = new RedisCache(config.redis, logger);

    let verifier: IAuthVerifier | null = null;
    if (config.auth.enabled) {
        verifier = new JwksAuthVerifier({
            jwksUri: config.auth.jwksUri!,
            audience: config.auth.audience,
            issuer: config.auth.issuer,
            algorithms: config.auth.algorithms,
            cacheMaxAgeMs: config.auth.cacheMaxAgeMs,
            clockToleranceSec: config.auth.clockToleranceSec,
        });
    }

    try {
        await esRepo.ensureIndex();
    } catch (err) {
        logger.error('Failed to ensure Elasticsearch index', {
            error: err instanceof Error ? err.message : String(err),
        });
        process.exit(1);
    }

    try {
        await cache.connect();
    } catch (err) {
        logger.error('Failed to connect to Redis', { err });
        process.exit(1);
    }

    const searchService = new SearchService(esRepo, cache, logger, metrics, {
        defaultTtlSeconds: config.cache.defaultTtlSeconds,
        maxQueryLength: config.cache.maxQueryLength,
        maxLimit: 50,
    });

    const server = buildApolloServer({
        isProduction,
    });
    await server.start();

    app.use(requestId({ logger }));
    app.use(securityHeaders({ isProduction }));
    app.use(
        corsMiddleware({
            allowedOrigins: config.http.corsOrigins,
            isProduction,
        })
    );
    app.use(express.json({ limit: config.http.bodyLimitKb + 'kb' }));

    app.get('/healthz', liveness());
    app.get(
        '/readyz',
        readiness(
            { cache, es: esRepo },
            logger.child({ component: 'readiness' })
        )
    );

    app.use(
        '/metrics',
        basicAuth({
            credentials: config.metrics.basicAuth,
            isProduction,
        })
    );
    app.get('/metrics', async (_req: Request, res: Response) => {
        try {
            res.set('Content-Type', metrics.getContentType());
            res.send(await metrics.getMetrics());
        } catch (err) {
            logger.error('Metrics endpoint failed', {
                error: err instanceof Error ? err.message : String(err),
            });
            res.status(500).json({ error: 'metrics_unavailable' });
        }
    });

    if (verifier) {
        app.use(
            authMiddleware({ verifier, logger, enabled: config.auth.enabled })
        );
    }

    app.use(
        '/graphql',
        expressMiddleware(server, {
            context: async ({ req }) => ({
                searchService,
                viewer: (req as Request & { viewer?: unknown }).viewer,
            }),
        })
    );

    await new Promise<void>((resolve) =>
        httpServer!.listen({ port: config.api!.port }, resolve)
    );

    logger.info(`🚀 Search API ready at http://localhost:${config.api!.port}/graphql`);
    logger.info(`📊 Metrics ready at http://localhost:${config.api!.port}/metrics`);
    logger.info(`🩺 Health: /healthz /readyz`);
};

start().catch((err) => {
    console.error(err);
    process.exit(1);
});
