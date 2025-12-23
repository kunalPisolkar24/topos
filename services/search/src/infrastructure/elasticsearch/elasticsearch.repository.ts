import fetch from 'node-fetch';
import { IElasticsearchRepository } from '../../core/interfaces/repository.interface.js';
import { PostDocument } from '../../core/entities/post.entity.js';
import { config } from '../../config/index.js';
import { ILogger } from '../../core/interfaces/logger.interface.js';

export class ElasticsearchRepository implements IElasticsearchRepository {
  constructor(private readonly logger: ILogger) {}

  async upsert(document: PostDocument): Promise<void> {
    const url = `${config.ELASTICSEARCH_URL}/${config.ELASTICSEARCH_INDEX}/_doc/${document.postId}`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(document),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Elasticsearch Upsert Failed: ${response.status} ${errorText}`);
    }
  }

  async delete(id: string): Promise<void> {
    const url = `${config.ELASTICSEARCH_URL}/${config.ELASTICSEARCH_INDEX}/_doc/${id}`;
    
    const response = await fetch(url, {
      method: 'DELETE',
    });

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text();
      throw new Error(`Elasticsearch Delete Failed: ${response.status} ${errorText}`);
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(config.ELASTICSEARCH_URL);
      return response.ok;
    } catch (error) {
      this.logger.error('Elasticsearch health check failed', { error });
      return false;
    }
  }
}