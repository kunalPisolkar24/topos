import { Server } from 'node:http';
import { logger } from './logger';
import prisma from './prisma';
import { CacheFactory } from './cache';

export class ShutdownManager {
    private server: Server;
    private isShuttingDown = false;
    private readonly SHUTDOWN_TIMEOUT = 10000;

    constructor(server: Server) {
        this.server = server;
        this.handleSignal('SIGTERM');
        this.handleSignal('SIGINT');
    }

    private handleSignal(signal: string) {
        process.on(signal, async () => {
            if (this.isShuttingDown) return;
            this.isShuttingDown = true;

            logger.info({ msg: `Received ${signal}, starting graceful shutdown` });

            const timeout = setTimeout(() => {
                logger.error({ msg: 'Shutdown timed out, forcing exit' });
                process.exit(1);
            }, this.SHUTDOWN_TIMEOUT);

            try {
                await this.closeHttpServer();
                await this.closeDatabaseConnection();
                await this.closeCacheConnection();
                
                logger.info({ msg: 'Graceful shutdown completed' });
                clearTimeout(timeout);
                process.exit(0);
            } catch (error) {
                logger.error({ msg: 'Error during shutdown', error });
                process.exit(1);
            }
        });
    }

    private closeHttpServer(): Promise<void> {
        return new Promise((resolve, reject) => {
            logger.info({ msg: 'Closing HTTP server' });
            this.server.close((err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    private async closeDatabaseConnection() {
        logger.info({ msg: 'Closing database connection' });
        await prisma.$disconnect();
    }

    private async closeCacheConnection() {
        logger.info({ msg: 'Closing cache connection' });
        await CacheFactory.disconnect();
    }
}