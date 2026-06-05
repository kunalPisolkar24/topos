import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import express from 'express';
import http from 'http';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { typeDefs } from './api/graphql/schema.js';
import { resolvers } from './api/graphql/resolvers.js';
import { PinoLogger } from './infrastructure/logger/pino.logger.js';
import { ElasticsearchRepository } from './infrastructure/elasticsearch/elasticsearch.repository.js';
import { RedisCache } from './infrastructure/redis/redis.cache.js';
import { PrometheusMetrics } from './infrastructure/monitoring/prometheus.metrics.js';
import { SearchService } from './api/services/search.service.js';
import { buildConfig, ConfigValidationError } from './config/index.js';

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
    const httpServer = http.createServer(app);
    const logger = new PinoLogger({
        service: config.service,
        logging: config.logging,
    });
    const metrics = new PrometheusMetrics();

    const esRepo = new ElasticsearchRepository(config.elasticsearch, logger, metrics);
    const cache = new RedisCache(config.redis, logger);

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

    const server = new ApolloServer({
        schema: buildSubgraphSchema({ typeDefs, resolvers: resolvers as any }),
    });

    await server.start();

    app.use(express.json());

    app.get('/metrics', async (_req, res) => {
        try {
            res.set('Content-Type', metrics.getContentType());
            res.send(await metrics.getMetrics());
        } catch (err) {
            res.status(500).send(err);
        }
    });

    app.use(
        '/graphql',
        expressMiddleware(server, {
            context: async () => ({ searchService }),
        })
    );

    await new Promise<void>((resolve) =>
        httpServer.listen({ port: config.api!.port }, resolve)
    );

    logger.info(`🚀 Search API ready at http://localhost:${config.api!.port}/graphql`);
    logger.info(`📊 Metrics ready at http://localhost:${config.api!.port}/metrics`);
};

start().catch((err) => {
    console.error(err);
    process.exit(1);
});
