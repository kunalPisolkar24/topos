import { createHash } from 'node:crypto';
import { ISearchReader } from '../../core/interfaces/repository.interface.js';
import { ICacheService } from '../../core/interfaces/cache.interface.js';
import { ILogger } from '../../core/interfaces/logger.interface.js';
import { IMetricsService } from '../../core/interfaces/metrics.interface.js';
import { SearchResult } from '../../core/entities/post.entity.js';
import { ValidationError } from '../../core/errors/app.error.js';

export interface SearchServiceConfig {
    defaultTtlSeconds: number;
    maxQueryLength: number;
    maxLimit: number;
}

const METRIC_OPERATION = 'searchPosts';

const hashQuery = (raw: string): string =>
    createHash('sha1').update(raw).digest('hex').slice(0, 32);

const buildCacheKey = (queryHash: string, page: number, limit: number): string =>
    `search:q:${queryHash}:p:${page}:l:${limit}`;

export class SearchService {
    private readonly maxLimit: number;
    private readonly maxQueryLength: number;
    private readonly defaultTtlSeconds: number;

    constructor(
        private readonly searchReader: ISearchReader,
        private readonly cache: ICacheService,
        private readonly logger: ILogger,
        private readonly metrics: IMetricsService,
        config: SearchServiceConfig
    ) {
        this.defaultTtlSeconds = config.defaultTtlSeconds;
        this.maxQueryLength = config.maxQueryLength;
        this.maxLimit = config.maxLimit;
    }

    async searchPosts(query: string, page: number, limit: number): Promise<SearchResult> {
        this.validateInputs(query, page, limit);

        const normalisedQuery = query.toLowerCase().trim();
        const queryHash = hashQuery(normalisedQuery);
        const cacheKey = buildCacheKey(queryHash, page, limit);
        const start = performance.now();

        try {
            const cached = await this.cache.get(cacheKey);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached) as SearchResult;
                    this.logger.debug('Cache hit', { key: cacheKey });
                    this.metrics.incrementCacheHit(METRIC_OPERATION);
                    this.metrics.recordSearchLatency((performance.now() - start) / 1000);
                    return parsed;
                } catch (parseErr) {
                    this.logger.warn('Corrupt cache value, evicting', {
                        key: cacheKey,
                        error: parseErr,
                    });
                    this.metrics.incrementCacheReadError(METRIC_OPERATION);
                    try {
                        await this.cache.delete(cacheKey);
                    } catch (deleteErr) {
                        this.logger.warn('Cache evict after corrupt read failed', {
                            key: cacheKey,
                            error: deleteErr,
                        });
                    }
                }
            } else {
                this.metrics.incrementCacheMiss(METRIC_OPERATION);
            }
        } catch (error) {
            this.logger.warn('Cache read failed', { error });
            this.metrics.incrementCacheReadError(METRIC_OPERATION);
        }

        try {
            const results = await this.searchReader.search(query, page, limit);

            try {
                await this.cache.set(cacheKey, JSON.stringify(results), this.defaultTtlSeconds);
            } catch (error) {
                this.logger.warn('Cache write failed', { error });
                this.metrics.incrementCacheWriteError(METRIC_OPERATION);
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

    private validateInputs(query: string, page: number, limit: number): void {
        if (typeof query !== 'string') {
            throw new ValidationError('query must be a string');
        }
        const trimmed = query.trim();
        if (trimmed.length === 0) {
            throw new ValidationError('query must be a non-empty string');
        }
        if (query.length > this.maxQueryLength) {
            throw new ValidationError(
                `query length must be <= ${this.maxQueryLength} characters`
            );
        }
        if (!Number.isInteger(page) || page < 1) {
            throw new ValidationError('page must be an integer >= 1');
        }
        if (!Number.isInteger(limit) || limit < 1 || limit > this.maxLimit) {
            throw new ValidationError(`limit must be an integer between 1 and ${this.maxLimit}`);
        }
    }
}
