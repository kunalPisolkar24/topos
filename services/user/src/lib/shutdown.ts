import { Server } from 'node:http';
import { logger } from './logger';

export interface ShutdownCloser {
    readonly name: string;
    readonly close: () => Promise<void>;
}

export class ShutdownManager {
    private readonly server: Server;
    private readonly closers: readonly ShutdownCloser[];
    private isShuttingDown = false;
    private readonly shutdownTimeoutMs: number;

    constructor(server: Server, closers: readonly ShutdownCloser[] = [], shutdownTimeoutMs = 10_000) {
        this.server = server;
        this.closers = closers;
        this.shutdownTimeoutMs = shutdownTimeoutMs;
        this.handleSignal('SIGTERM');
        this.handleSignal('SIGINT');
    }

    private handleSignal(signal: string): void {
        process.on(signal, async () => {
            if (this.isShuttingDown) return;
            this.isShuttingDown = true;

            logger.info({ msg: `Received ${signal}, starting graceful shutdown` });

            const timeout = setTimeout(() => {
                logger.error({ msg: 'Shutdown timed out, forcing exit' });
                this.forceExit(1);
            }, this.shutdownTimeoutMs);
            timeout.unref();

            try {
                await this.closeHttpServer();
                for (const closer of this.closers) {
                    try {
                        await closer.close();
                    } catch (error) {
                        logger.error({ msg: `Closer ${closer.name} failed`, error });
                    }
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
}
