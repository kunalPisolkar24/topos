import { ISearchReader } from '../../core/interfaces/repository.interface.js';
import { ICacheService } from '../../core/interfaces/cache.interface.js';
import { ILogger } from '../../core/interfaces/logger.interface.js';
import { IMetricsService } from '../../core/interfaces/metrics.interface.js';
import { SearchResult } from '../../core/entities/post.entity.js';

export class SearchService {
	constructor(
		private readonly searchReader: ISearchReader,
		private readonly cache: ICacheService,
		private readonly logger: ILogger,
		private readonly metrics: IMetricsService
	) { }

	async searchPosts(query: string, page: number, limit: number): Promise<SearchResult> {
		const start = performance.now();
		const cacheKey = `search:q:${query.toLowerCase()}:p:${page}:l:${limit}`;

		try {
			const cached = await this.cache.get(cacheKey);
			if (cached) {
				this.logger.debug('Cache hit', { key: cacheKey });
				this.metrics.incrementCacheHit('searchPosts');
				this.metrics.recordSearchLatency((performance.now() - start) / 1000);
				return JSON.parse(cached);
			}
			this.metrics.incrementCacheMiss('searchPosts');
		} catch (error) {
			this.logger.warn('Cache read failed', { error });
		}

		try {
			const results = await this.searchReader.search(query, page, limit);

			try {
				await this.cache.set(cacheKey, JSON.stringify(results), 120);
			} catch (error) {
				this.logger.warn('Cache write failed', { error });
			}

			this.metrics.incrementSearchCount('success');
			this.metrics.recordSearchLatency((performance.now() - start) / 1000);
			return results;
		} catch (error) {
			this.metrics.incrementSearchCount('error');
			this.metrics.recordSearchLatency((performance.now() - start) / 1000);
			throw error;
		}
	}
}