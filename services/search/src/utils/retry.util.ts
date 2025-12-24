import { ILogger } from '../core/interfaces/logger.interface.js';

interface RetryOptions {
    retries: number;
    delay: number;
    factor?: number;
}

export async function withRetry<T>(
    fn: () => Promise<T>,
    logger: ILogger,
    options: RetryOptions = { retries: 3, delay: 1000, factor: 2 }
): Promise<T> {
    let attempt = 0;
    let currentDelay = options.delay;

    while (true) {
        try {
            return await fn();
        } catch (error: any) {
            attempt++;
            if (attempt > options.retries) {
                throw error;
            }

            logger.warn(`Operation failed, retrying...`, {
                attempt,
                maxRetries: options.retries,
                error: error.message,
            });

            await new Promise((resolve) => setTimeout(resolve, currentDelay));
            if (options.factor) {
                currentDelay *= options.factor;
            }
        }
    }
}