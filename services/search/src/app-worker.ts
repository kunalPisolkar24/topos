import { Kafka } from 'kafkajs';
import express from 'express';
import { config } from './config/index.js';
import { PinoLogger } from './infrastructure/logger/pino.logger.js';
import { ElasticsearchRepository } from './infrastructure/elasticsearch/elasticsearch.repository.js';
import { PrometheusMetrics } from './infrastructure/monitoring/prometheus.metrics.js';
import { KafkaDlqProducer } from './infrastructure/kafka/dlq.producer.js';
import { KafkaConsumer } from './infrastructure/kafka/kafka.consumer.js';
import { IngestService } from './worker/services/ingest.service.js';
import { withRetry } from './utils/retry.util.js';

const start = async () => {
	const logger = new PinoLogger();
	const metrics = new PrometheusMetrics();
	
	logger.info('Starting Search Worker');

	const metricsApp = express();
	
	metricsApp.get('/metrics', async (_req, res) => {
		try {
			res.set('Content-Type', metrics.getContentType());
			res.send(await metrics.getMetrics());
		} catch (err) {
			res.status(500).send(err);
		}
	});

	metricsApp.listen(config.WORKER_METRICS_PORT, () => {
		logger.info(`📊 Worker Metrics ready at http://localhost:${config.WORKER_METRICS_PORT}/metrics`);
	});

	const kafka = new Kafka({
		clientId: config.KAFKA_CLIENT_ID,
		brokers: config.KAFKA_BROKER.split(','),
		retry: {
			initialRetryTime: 500,
			retries: 10,
		},
	});

	const dlqProducer = new KafkaDlqProducer(kafka, logger);
	const consumer = new KafkaConsumer(kafka, logger);
	const esRepo = new ElasticsearchRepository(logger, metrics);

	const ingestService = new IngestService(esRepo, dlqProducer, logger, metrics);

	const bootstrap = async () => {
		await dlqProducer.connect();
		await consumer.connect();

		await consumer.startBatch(async (batchPayload) => {
			await ingestService.processBatch(batchPayload);
		});
	};

	try {
		await withRetry(bootstrap, logger, { retries: 10, delay: 2000 });

		const shutdown = async () => {
			logger.info('Shutting down...');
			await consumer.disconnect();
			await dlqProducer.disconnect();
			process.exit(0);
		};

		process.on('SIGINT', shutdown);
		process.on('SIGTERM', shutdown);

	} catch (err) {
		logger.error('Fatal Worker Error', { err });
		process.exit(1);
	}
};

start().catch((err) => {
	console.error(err);
	process.exit(1);
});