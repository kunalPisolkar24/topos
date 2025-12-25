import { IElasticsearchRepository } from '../../core/interfaces/repository.interface.js';
import { IDlqProducer } from '../../core/interfaces/message-broker.interface.js';
import { ILogger } from '../../core/interfaces/logger.interface.js';
import { PostDocument } from '../../core/entities/post.entity.js';
import { config } from '../../config/index.js';
import { ParseError } from '../../core/errors/app.error.js';

export class IngestService {
  constructor(
    private readonly esRepository: IElasticsearchRepository,
    private readonly dlqProducer: IDlqProducer,
    private readonly logger: ILogger
  ) { }

  async processEvent(key: string | null, value: Buffer | null): Promise<void> {
    const rawKey = key || 'unknown';

    try {
      if (!value) {
        if (!key) {
          this.logger.warn('Received null value and null key. Skipping.');
          return;
        }
        await this.handleDelete(key);
        return;
      }

      await this.handleUpsert(key, value);
    } catch (error: any) {
      this.logger.error('Error processing event', { key: rawKey, error: error.message });

      await this.dlqProducer.publish({
        originalTopic: config.TOPIC_POSTS,
        failedAt: new Date().toISOString(),
        error: error.message,
        key: rawKey,
        payload: value ? value.toString() : null,
      });
    }
  }

  private async handleUpsert(key: string | null, value: Buffer): Promise<void> {
    try {
      const rawData = value.toString();
      const post: PostDocument = JSON.parse(rawData);
      await this.esRepository.upsert(post);
      this.logger.info('Document synced to Elasticsearch', { postId: post.postId });
    } catch (error: any) {
      if (error instanceof SyntaxError) {
        throw new ParseError(`Failed to parse JSON: ${error.message}`);
      }
      throw error;
    }
  }

  private async handleDelete(key: string): Promise<void> {
    await this.esRepository.delete(key);
    this.logger.info('Document deleted from Elasticsearch', { postId: key });
  }
}