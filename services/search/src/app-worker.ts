import { Kafka } from 'kafkajs';
import { config } from './config/index.js';
import { PinoLogger } from './infrastructure/logger/pino.logger.js';
import { ElasticsearchRepository } from './infrastructure/elasticsearch/elasticsearch.repository.js';
import { KafkaDlqProducer } from './infrastructure/kafka/dlq.producer.js';
import { KafkaConsumer } from './infrastructure/kafka/kafka.consumer.js';
import { IngestService } from './worker/services/ingest.service.js';
import { KafkaHandler } from './worker/handlers/kafka.handler.js';
import { withRetry } from './utils/retry.util.js';

const start = async () => {
	const logger = new PinoLogger();
	logger.info('Starting Search Worker...');

	const kafka = new Kafka({
		clientId: config.KAFKA_CLIENT_ID,
		brokers: [config.KAFKA_BROKER],
		retry: {
			initialRetryTime: 1000,
			retries: 10,
		},
	});

	const dlqProducer = new KafkaDlqProducer(kafka, logger);
	const consumer = new KafkaConsumer(kafka, logger);
	const esRepo = new ElasticsearchRepository(logger);

	const ingestService = new IngestService(esRepo, dlqProducer, logger);
	const kafkaHandler = new KafkaHandler(ingestService);

	const bootstrap = async () => {
		await dlqProducer.connect();
		await consumer.connect();

		await consumer.start(async (key, value) => {
			await kafkaHandler.handle(key, value);
		});
	};

	try {
		await withRetry(bootstrap, logger, { retries: 15, delay: 3000, factor: 1 });

		const shutdown = async () => {
			logger.info('Shutting down...');
			await consumer.disconnect();
			await dlqProducer.disconnect();
			process.exit(0);
		};

		process.on('SIGINT', shutdown);
		process.on('SIGTERM', shutdown);

	} catch (err) {
		logger.error('Fatal Error after retries', { err });
		process.exit(1);
	}
};

start().catch((err) => {
	console.error(err);
	process.exit(1);
});