import { Kafka, Consumer, EachBatchPayload } from 'kafkajs';
import { IMessageConsumer } from '../../core/interfaces/message-broker.interface.js';
import { getWorkerConfig } from '../../config/index.js';
import { ILogger } from '../../core/interfaces/logger.interface.js';

export interface IBatchConsumer {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  startBatch(handler: (payload: EachBatchPayload) => Promise<void>): Promise<void>;
}

export class KafkaConsumer implements IBatchConsumer {
  private consumer: Consumer;
  private readonly config = getWorkerConfig();

  constructor(kafka: Kafka, private readonly logger: ILogger) {
    this.consumer = kafka.consumer({ 
      groupId: this.config.KAFKA_GROUP_ID,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });
  }

  async connect(): Promise<void> {
    await this.consumer.connect();
    this.logger.info('Kafka Consumer connected');
  }

  async disconnect(): Promise<void> {
    await this.consumer.disconnect();
    this.logger.info('Kafka Consumer disconnected');
  }

  async startBatch(handler: (payload: EachBatchPayload) => Promise<void>): Promise<void> {
    await this.consumer.subscribe({ topic: this.config.TOPIC_POSTS, fromBeginning: true });
    
    await this.consumer.run({
      autoCommit: false, 
      eachBatchAutoResolve: false,
      partitionsConsumedConcurrently: 3,
      eachBatch: async (payload) => {
        try {
            await handler(payload);
        } catch (error: any) {
            this.logger.error('Fatal Batch Error', { error: error.message });
            throw error; 
        }
      },
    });
  }
}
