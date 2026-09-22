import type { ServerType } from '@hono/node-server';
import { closeDb } from './prisma.js';
import { closeRedis } from './redis.js';
import { setShuttingDown } from './shutdownState.js';
import { logger } from '../observability/logger.js';

export function setupGracefulShutdown(server: ServerType): void {
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, async () => {
      logger.info(`${signal} received, shutting down`);
      setShuttingDown(true);
      server.close(async () => {
        await closeRedis();
        await closeDb();
        process.exit(0);
      });
      setTimeout(() => {
        logger.error('shutdown timed out, forcing exit');
        process.exit(1);
      }, 10_000).unref();
    });
  }
}
