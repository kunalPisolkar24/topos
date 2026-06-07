import { DlqMessage } from '../entities/dlq-message.entity.js';

export interface IDlqProducer {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  publish(message: DlqMessage): Promise<void>;
}

export interface IMessageConsumer {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  start(handler: (key: string | null, value: Buffer | null) => Promise<void>): Promise<void>;
}