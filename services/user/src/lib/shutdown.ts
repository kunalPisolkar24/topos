import { Server } from 'node:http';
import { logger } from './logger';
import prisma from './prisma';

export class ShutdownManager {
    private server: Server;
    private extraClosers: Array<() => Promise<void>>;
    private isShuttingDown = false;
    private readonly SHUTDOWN_TIMEOUT = 10000;

    constructor(server: Server, extraClosers: Array<() => Promise<void>> = []) {
        this.server = server;
        this.extraClosers = extraClosers;
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
                this.forceExit(1);
            }, this.SHUTDOWN_TIMEOUT);
            timeout.unref();

            try {
                await this.closeHttpServer();
                await this.closeDatabaseConnection();
                for (const closer of this.extraClosers) {
                    await closer();
                }

                logger.info({ msg: 'Graceful shutdown completed' });
                clearTimeout(timeout);
                process.exit(0);
            } catch (error) {
                logger.error({ msg: 'Error during shutdown', error });
                clearTimeout(timeout);
                this.forceExit(1);
            }
        });
    }

    private forceExit(code: number): never {
        const socket = (this.server as unknown as { closeAllConnections?: () => void });
        socket.closeAllConnections?.();
        process.exit(code);
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
}
