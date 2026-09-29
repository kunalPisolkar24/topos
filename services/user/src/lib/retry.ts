import { isConnectionEstablishmentError, isTransientDbError } from '../errors.js';

export type RetryErrorCheck = (error: unknown) => boolean;

export { isConnectionEstablishmentError, isTransientDbError };

export interface RetryOptions {
  maxRetries?: number;
  baseMs?: number;
  retryOn?: RetryErrorCheck;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(op: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxRetries = 2, baseMs = 100, retryOn = isTransientDbError } = options;
  let attempt = 0;

  const run = async (): Promise<T> => {
    try {
      return await op();
    } catch (error) {
      if (attempt >= maxRetries || !retryOn(error)) {
        throw error;
      }
      attempt += 1;
      const backoff = baseMs * 2 ** (attempt - 1);
      await sleep(backoff + backoff * 0.5 * Math.random());
      return run();
    }
  };

  return run();
}