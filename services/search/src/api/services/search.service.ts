import { ISearchReader } from '../../core/interfaces/repository.interface.js';
import { ICacheService } from '../../core/interfaces/cache.interface.js';
import { ILogger } from '../../core/interfaces/logger.interface.js';
import { SearchResult } from '../../core/entities/post.entity.js';

export class SearchService {
	constructor(
		private readonly searchReader: ISearchReader,
		private readonly cache: ICacheService,
		private readonly logger: ILogger
	) { }

	async searchPosts(query: string, page: number, limit: number): Promise<SearchResult> {
		const cacheKey = `search:q:${query.toLowerCase()}:p:${page}:l:${limit}`;

		try {
			const cached = await this.cache.get(cacheKey);
			if (cached) {
				this.logger.debug('Cache hit', { key: cacheKey });
				return JSON.parse(cached);
			}
		} catch (error) {
			this.logger.warn('Cache read failed', { error });
		}

		const results = await this.searchReader.search(query, page, limit);

		try {
			await this.cache.set(cacheKey, JSON.stringify(results), 120);
		} catch (error) {
			this.logger.warn('Cache write failed', { error });
		}

		return results;
	}
}