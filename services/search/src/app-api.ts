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
import { config } from './config/index.js';

const start = async () => {
	const app = express();
	const httpServer = http.createServer(app);
	const logger = new PinoLogger();
	const metrics = new PrometheusMetrics();
	
	const esRepo = new ElasticsearchRepository(logger, metrics);
	const cache = new RedisCache(logger);

	try {
		await cache.connect();
	} catch (err) {
		logger.error('Failed to connect to Redis', { err });
		process.exit(1);
	}

	const searchService = new SearchService(esRepo, cache, logger, metrics);

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

	await new Promise<void>((resolve) => httpServer.listen({ port: config.API_PORT }, resolve));

	logger.info(`🚀 Search API ready at http://localhost:${config.API_PORT}/graphql`);
	logger.info(`📊 Metrics ready at http://localhost:${config.API_PORT}/metrics`);
};

start().catch((err) => {
	console.error(err);
	process.exit(1);
});