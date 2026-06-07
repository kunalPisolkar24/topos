import { ILogger } from '../core/interfaces/logger.interface.js';

export const withTimeout = async <T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    label: string,
    logger?: ILogger
): Promise<T | undefined> => {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<undefined>((resolve) => {
        timer = setTimeout(() => {
            logger?.warn(`Operation '${label}' timed out after ${timeoutMs}ms`);
            resolve(undefined);
        }, timeoutMs);
    });
    try {
        return await Promise.race([operation(), timeout]);
    } finally {
        if (timer) clearTimeout(timer);
    }
};

export interface ShutdownStep {
    name: string;
    run: () => Promise<void>;
}

export const runShutdown = async (
    steps: ShutdownStep[],
    logger: ILogger,
    timeoutMs: number
): Promise<void> => {
    for (const step of steps) {
        try {
            await withTimeout(step.run, timeoutMs, step.name, logger);
        } catch (err) {
            logger.error(`Shutdown step '${step.name}' failed`, {
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
};
