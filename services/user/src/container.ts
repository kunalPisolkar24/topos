import { env } from './config/env.js';
import { CacheManager } from './lib/cache.js';
import { pool, prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';
import { Metrics } from './observability/metrics.js';
import { UserRepository } from './repositories/user.repository.js';
import { UserService } from './user.service.js';

export interface Services {
  metrics: Metrics;
  userService: UserService;
}

export function createServices(): Services {
  const metrics = new Metrics();
  metrics.registerDbPool(pool);
  metrics.registerRedis(redis);
  const userService = new UserService(
    new UserRepository(prisma, metrics),
    new CacheManager(redis, metrics, env.REDIS_MISSING_CACHE_TTL_MS),
    env.REDIS_CACHE_TTL_MS,
    metrics,
  );
  return { metrics, userService };
}
