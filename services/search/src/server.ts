import { App } from './app.js';
import express from 'express';
import { config } from './config/index.js';

const start = async () => {
    const app = new App();
    await app.start();

    const healthServer = express();
    healthServer.get('/health', (req, res) => {
        res.status(200).json({ status: 'OK', service: 'elasticsearch-worker' });
    });

    healthServer.listen(config.PORT, () => {
        console.log(`Health check server listening on port ${config.PORT}`);
    });
};

start().catch((err) => {
    console.error('Fatal error starting application', err);
    process.exit(1);
});