import { ILogger } from '../core/interfaces/logger.interface.js';

export type JitterMode = 'none' | 'full' | 'equal';

export interface RetryOptions {
    retries: number;
    delay: number;
    factor?: number;
    maxDelay?: number;
    jitter?: JitterMode;
    onFailedAttempt?: (error: unknown, attempt: number) => void;
    signal?: AbortSignal;
}

const computeBackoff = (base: number, factor: number, max: number): number => {
    const next = base * factor;
    return Number.isFinite(next) ? Math.min(next, max) : max;
};

const applyJitter = (delay: number, mode: JitterMode): number => {
    if (mode === 'none') return delay;
    if (mode === 'full') {
        return Math.random() * delay;
    }
    const half = delay / 2;
    return half + Math.random() * half;
};

const sleep = (ms: number, signal?: AbortSignal): Promise<void> => {
    if (signal?.aborted) {
        return Promise.reject(new Error('Retry aborted'));
    }
    return new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, ms);
        if (signal) {
            const onAbort = () => {
                clearTimeout(timer);
                reject(new Error('Retry aborted'));
            };
            signal.addEventListener('abort', onAbort, { once: true });
        }
    });
};

export async function withRetry<T>(
    fn: () => Promise<T>,
    logger: ILogger,
    options: Partial<RetryOptions> = {}
): Promise<T> {
    const retries = options.retries ?? 3;
    const baseDelay = options.delay ?? 1000;
    const factor = options.factor ?? 2;
    const maxDelay = options.maxDelay ?? 30000;
    const jitter: JitterMode = options.jitter ?? 'full';
    const { onFailedAttempt, signal } = options;

    let attempt = 0;
    let currentDelay = baseDelay;

    while (true) {
        if (signal?.aborted) {
            throw new Error('Retry aborted before attempt');
        }
        try {
            return await fn();
        } catch (error) {
            attempt += 1;
            if (onFailedAttempt) {
                try {
                    onFailedAttempt(error, attempt);
                } catch {
                    /* swallow observer errors so retry still proceeds */
                }
            }
            if (attempt > retries) {
                throw error;
            }

            logger.warn('Operation failed, retrying', {
                attempt,
                maxRetries: retries,
                error: error instanceof Error ? error.message : String(error),
            });

            const wait = applyJitter(currentDelay, jitter);
            await sleep(wait, signal);

            currentDelay = computeBackoff(currentDelay, factor, maxDelay);
        }
    }
}
