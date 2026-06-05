import { Kafka } from 'kafkajs';
import express, { Request, Response } from 'express';
import http from 'http';
import { buildConfig, ConfigValidationError } from './config/index.js';
import { PinoLogger } from './infrastructure/logger/pino.logger.js';
import { ElasticsearchRepository } from './infrastructure/elasticsearch/elasticsearch.repository.js';
import { PrometheusMetrics } from './infrastructure/monitoring/prometheus.metrics.js';
import { KafkaDlqProducer } from './infrastructure/kafka/dlq.producer.js';
import { KafkaConsumer } from './infrastructure/kafka/kafka.consumer.js';
import { IngestService } from './worker/services/ingest.service.js';
import { withRetry } from './utils/retry.util.js';
import { runShutdown, ShutdownStep } from './utils/shutdown.util.js';
import { requestId } from './api/middleware/request-id.middleware.js';
import { securityHeaders } from './api/middleware/security-headers.middleware.js';
import { basicAuth } from './api/middleware/basic-auth.middleware.js';
import { liveness, readiness } from './api/middleware/health.middleware.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;
let consumer: KafkaConsumer | null = null;
let dlqProducer: KafkaDlqProducer | null = null;
let metricsServer: http.Server | null = null;
let loggerRef: PinoLogger | null = null;
let isShuttingDown = false;

const shutdown = async (signal: string): Promise<void> => {
    if (!loggerRef) {
        process.exit(0);
    }
    if (isShuttingDown) return;
    isShuttingDown = true;
    loggerRef.info(`Received ${signal}, shutting down`);

    const steps: ShutdownStep[] = [
        { name: 'consumer.disconnect', run: async () => { if (consumer) await consumer.disconnect(); } },
        { name: 'dlqProducer.disconnect', run: async () => { if (dlqProducer) await dlqProducer.disconnect(); } },
        {
            name: 'metricsServer.close',
            run: async () => {
                if (metricsServer) {
                    await new Promise<void>((resolve) => metricsServer!.close(() => resolve()));
                }
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

    if (!config.worker || !config.kafka) {
        console.error('KAFKA_BROKER and WORKER_METRICS_PORT must be set to run the worker');
        process.exit(1);
    }

    const isProduction = config.service.env === 'production';
    const logger = new PinoLogger({
        service: config.service,
        logging: config.logging,
    });
    loggerRef = logger;
    const metrics = new PrometheusMetrics();

    logger.info('Starting Search Worker');

    const metricsApp = express();
    if (config.http.trustProxy) {
        metricsApp.set('trust proxy', true);
    }
    metricsServer = http.createServer(metricsApp);

    metricsApp.use(requestId({ logger }));
    metricsApp.use(securityHeaders({ isProduction }));
    metricsApp.use(
        basicAuth({ credentials: config.metrics.basicAuth, isProduction })
    );

    metricsApp.get('/healthz', liveness());
    metricsApp.get(
        '/readyz',
        readiness(
            {
                es: { checkHealth: async () => true },
                kafka: {
                    isHealthy: async () => (consumer ? consumer.isHealthy() : false),
                },
            },
            logger.child({ component: 'readiness' })
        )
    );

    metricsApp.get('/metrics', async (_req: Request, res: Response) => {
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

    await new Promise<void>((resolve) =>
        metricsServer!.listen(config.worker!.metricsPort, resolve)
    );
    logger.info(
        `📊 Worker Metrics ready at http://localhost:${config.worker!.metricsPort}/metrics`
    );

    const kafka = new Kafka({
        clientId: config.kafka.clientId,
        brokers: config.kafka.brokers,
        retry: {
            initialRetryTime: 500,
            retries: 10,
        },
    });

    dlqProducer = new KafkaDlqProducer(kafka, config.kafka, logger);
    consumer = new KafkaConsumer(kafka, config.kafka, logger);
    const esRepo = new ElasticsearchRepository(config.elasticsearch, logger, metrics);

    try {
        await esRepo.ensureIndex();
    } catch (err: any) {
        logger.error('Failed to ensure Elasticsearch index', { error: err.message });
        process.exit(1);
    }

    const ingestService = new IngestService(esRepo, dlqProducer, logger, metrics);

    const bootstrap = async () => {
        await dlqProducer!.connect();
        await consumer!.connect();

        await consumer!.startBatch(async (batchPayload) => {
            await ingestService.processBatch(batchPayload);
        });
    };

    try {
        await withRetry(bootstrap, logger, { retries: 10, delay: 2000 });
    } catch (err) {
        logger.error('Fatal Worker Error', { err });
        process.exit(1);
    }
};

start().catch((err) => {
    console.error(err);
    process.exit(1);
});
