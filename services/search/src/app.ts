import { Kafka } from 'kafkajs';
import { config } from './config/index.js';
import { PinoLogger } from './infrastructure/logger/pino.logger.js';
import { ElasticsearchRepository } from './infrastructure/elasticsearch/elasticsearch.repository.js';
import { KafkaDlqProducer } from './infrastructure/kafka/dlq.producer.js';
import { KafkaConsumer } from './infrastructure/kafka/kafka.consumer.js';
import { SearchService } from './services/search.service.js';

export class App {
    private logger: PinoLogger;
    private dlqProducer: KafkaDlqProducer;
    private consumer: KafkaConsumer;
    private searchService: SearchService;

    constructor() {
        this.logger = new PinoLogger();

        const kafka = new Kafka({
            clientId: config.KAFKA_CLIENT_ID,
            brokers: [config.KAFKA_BROKER],
        });

        this.dlqProducer = new KafkaDlqProducer(kafka, this.logger);
        this.consumer = new KafkaConsumer(kafka, this.logger);

        const esRepo = new ElasticsearchRepository(this.logger);

        this.searchService = new SearchService(esRepo, this.dlqProducer, this.logger);
    }

    async start(): Promise<void> {
        this.logger.info('Starting Search Worker...');

        await this.dlqProducer.connect();
        await this.consumer.connect();

        await this.consumer.start(async (key: any, value: any) => {
            await this.searchService.processEvent(key, value);
        });

        this.setupGracefulShutdown();
    }

    private setupGracefulShutdown(): void {
        const shutdown = async (signal: string) => {
            this.logger.info(`Received ${signal}. Shutting down...`);
            await this.consumer.disconnect();
            await this.dlqProducer.disconnect();
            process.exit(0);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
    }
}