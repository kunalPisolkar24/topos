import { Kafka, Consumer } from 'kafkajs';
import { IMessageConsumer } from '../../core/interfaces/message-broker.interface.js';
import { config } from '../../config/index.js';
import { ILogger } from '../../core/interfaces/logger.interface.js';

export class KafkaConsumer implements IMessageConsumer {
  private consumer: Consumer;

  constructor(kafka: Kafka, private readonly logger: ILogger) {
    this.consumer = kafka.consumer({ groupId: config.KAFKA_GROUP_ID });
  }

  async connect(): Promise<void> {
    await this.consumer.connect();
    this.logger.info('Kafka Consumer connected');
  }

  async disconnect(): Promise<void> {
    await this.consumer.disconnect();
    this.logger.info('Kafka Consumer disconnected');
  }

  async start(handler: (key: string | null, value: Buffer | null) => Promise<void>): Promise<void> {
    await this.consumer.subscribe({ topic: config.TOPIC_POSTS, fromBeginning: true });
    
    await this.consumer.run({
      eachMessage: async ({ message }) => {
        const key = message.key ? message.key.toString() : null;
        await handler(key, message.value);
      },
    });
  }
}