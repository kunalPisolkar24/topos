import { PostDocument } from '../entities/post.entity.js';

export interface IElasticsearchRepository {
  upsert(document: PostDocument): Promise<void>;
  delete(id: string): Promise<void>;
  checkHealth(): Promise<boolean>;
}