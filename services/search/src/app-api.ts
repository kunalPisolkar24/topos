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

    const app = express();
    httpServer = http.createServer(app);
    const logger = new PinoLogger({
        service: config.service,
        logging: config.logging,
    });
    loggerRef = logger;
    const metrics = new PrometheusMetrics();

    const esRepo = new ElasticsearchRepository(config.elasticsearch, logger, metrics);
    cache = new RedisCache(config.redis, logger);

    try {
        await esRepo.ensureIndex();
    } catch (err: any) {
        logger.error('Failed to ensure Elasticsearch index', { error: err.message });
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
        isProduction: config.service.env === 'production',
    });

    await server.start();

    app.use(express.json());

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

    app.use(
        '/graphql',
        expressMiddleware(server, {
            context: async () => ({ searchService }),
        })
    );

    await new Promise<void>((resolve) =>
        httpServer!.listen({ port: config.api!.port }, resolve)
    );

    logger.info(`🚀 Search API ready at http://localhost:${config.api!.port}/graphql`);
    logger.info(`📊 Metrics ready at http://localhost:${config.api!.port}/metrics`);
};

start().catch((err) => {
    console.error(err);
    process.exit(1);
});
