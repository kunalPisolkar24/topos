import './config/env';
import { serve } from '@hono/node-server';
import { env } from './config/env';
import { logger } from './lib/logger';
import { createApp } from './app';

createApp().then((app) => {
    logger.info(`🚀 User Service running on port ${env.PORT}`);
    serve({
        fetch: app.fetch,
        port: parseInt(env.PORT),
    });
}).catch((err) => {
    logger.fatal({ msg: 'Failed to start server', err });
    process.exit(1);
});