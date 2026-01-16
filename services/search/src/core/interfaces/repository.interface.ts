import { PostDocument, SearchResult } from '../entities/post.entity.js';

export interface ISearchReader {
  search(query: string, page: number, limit: number): Promise<SearchResult>;
  checkHealth(): Promise<boolean>;
}

export interface ISearchIndexer {
  bulkUpsert(documents: PostDocument[]): Promise<void>;
  bulkDelete(ids: string[]): Promise<void>;
}