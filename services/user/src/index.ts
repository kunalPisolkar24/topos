import './config/env';
import { serve } from '@hono/node-server';
import { env } from './config/env';
import { logger } from './lib/logger';
import { createApp } from './app';
import { ShutdownManager } from './lib/shutdown';

const start = async () => {
    try {
        const { buildApp } = await import('./app');
        const handle = await buildApp();

        logger.info(`🚀 User Service running on port ${env.PORT}`);

        const server = serve({
            fetch: handle.app.fetch,
            port: parseInt(env.PORT),
        });

        new ShutdownManager(server as any, [handle.shutdown]);

    } catch (err) {
        logger.fatal({ msg: 'Failed to start server', err });
        process.exit(1);
    }
};

start();
