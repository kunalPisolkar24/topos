import { PostDocument, SearchResult } from '../entities/post.entity.js';

export interface IElasticsearchRepository {
  upsert(document: PostDocument): Promise<void>;
  delete(id: string): Promise<void>;
  search(query: string, page: number, limit: number): Promise<SearchResult>;
  checkHealth(): Promise<boolean>;
}