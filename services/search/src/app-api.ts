import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { typeDefs } from './api/graphql/schema.js';
import { resolvers } from './api/graphql/resolvers.js';
import { PinoLogger } from './infrastructure/logger/pino.logger.js';
import { ElasticsearchRepository } from './infrastructure/elasticsearch/elasticsearch.repository.js';
import { RedisCache } from './infrastructure/redis/redis.cache.js';
import { SearchService } from './api/services/search.service.js';
import { config } from './config/index.js';

const start = async () => {
	const logger = new PinoLogger();
	const esRepo = new ElasticsearchRepository(logger);
	const cache = new RedisCache(logger);

	try {
		await cache.connect();
	} catch (err) {
		logger.error('Failed to connect to Redis', { err });
		process.exit(1);
	}

	const searchService = new SearchService(esRepo, cache, logger);

	const server = new ApolloServer({
		schema: buildSubgraphSchema({ typeDefs, resolvers: resolvers as any }),
	});

	const { url } = await startStandaloneServer(server, {
		listen: { port: config.API_PORT },
		context: async () => ({
			searchService,
		}),
	});

	logger.info(`🚀 Search API ready at ${url}`);
};

start().catch((err) => {
	console.error(err);
	process.exit(1);
});