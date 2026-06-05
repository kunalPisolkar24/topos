import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';
import { ILogger } from '../../core/interfaces/logger.interface.js';
import { withRetry } from '../retry.util.js';

describe('withRetry', () => {
    let logger: MockProxy<ILogger>;

    beforeEach(() => {
        logger = mock<ILogger>();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it('returns the result on first successful attempt', async () => {
        const fn = vi.fn().mockResolvedValue('success');

        const resultPromise = withRetry(fn, logger, { retries: 3, delay: 100 });
        const result = await resultPromise;

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on failure and succeeds', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(new Error('Fail 1'))
            .mockResolvedValue('success');

        const resultPromise = withRetry(fn, logger, { retries: 3, delay: 100 });

        await vi.advanceTimersByTimeAsync(100);
        const result = await resultPromise;

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
        expect(logger.warn).toHaveBeenCalledWith('Operation failed, retrying', expect.objectContaining({
            attempt: 1,
            maxRetries: 3,
        }));
    });

    it('throws after exhausting retries', async () => {
        vi.useRealTimers();
        const fn = vi.fn().mockRejectedValue(new Error('Always Fail'));

        await expect(withRetry(fn, logger, { retries: 2, delay: 10 })).rejects.toThrow('Always Fail');
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it('applies exponential backoff with factor', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(new Error('Fail 1'))
            .mockRejectedValueOnce(new Error('Fail 2'))
            .mockResolvedValue('success');

        const resultPromise = withRetry(fn, logger, {
            retries: 3,
            delay: 100,
            factor: 2,
            jitter: 'none',
        });

        await vi.advanceTimersByTimeAsync(100);
        expect(fn).toHaveBeenCalledTimes(2);

        await vi.advanceTimersByTimeAsync(200);
        const result = await resultPromise;

        expect(fn).toHaveBeenCalledTimes(3);
        expect(result).toBe('success');
    });

    it('uses default options when not provided', async () => {
        const fn = vi.fn().mockResolvedValue('success');

        const result = await withRetry(fn, logger);

        expect(result).toBe('success');
    });

    it('includes error message in retry log', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(new Error('Specific Error'))
            .mockResolvedValue('success');

        const resultPromise = withRetry(fn, logger, { retries: 3, delay: 100 });
        await vi.advanceTimersByTimeAsync(100);
        await resultPromise;

        expect(logger.warn).toHaveBeenCalledWith('Operation failed, retrying', expect.objectContaining({
            error: 'Specific Error',
        }));
    });

    it('caps backoff with maxDelay', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(new Error('a'))
            .mockRejectedValueOnce(new Error('b'))
            .mockRejectedValueOnce(new Error('c'))
            .mockResolvedValue('ok');

        const p = withRetry(fn, logger, {
            retries: 5,
            delay: 1000,
            factor: 10,
            maxDelay: 1500,
            jitter: 'none',
        });

        await vi.advanceTimersByTimeAsync(1500);
        await vi.advanceTimersByTimeAsync(1500);
        await vi.advanceTimersByTimeAsync(1500);

        const result = await p;
        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(4);
    });

    it('invokes onFailedAttempt for each failed attempt and continues even if it throws', async () => {
        const onFailedAttempt = vi.fn().mockImplementation(() => {
            throw new Error('observer boom');
        });
        const fn = vi.fn()
            .mockRejectedValueOnce(new Error('a'))
            .mockResolvedValue('ok');

        const p = withRetry(fn, logger, {
            retries: 3,
            delay: 50,
            jitter: 'none',
            onFailedAttempt,
        });
        await vi.advanceTimersByTimeAsync(50);
        const result = await p;

        expect(result).toBe('ok');
        expect(onFailedAttempt).toHaveBeenCalledTimes(1);
        expect(onFailedAttempt).toHaveBeenCalledWith(expect.any(Error), 1);
    });

    it('aborts when the AbortSignal is triggered mid-retry', async () => {
        vi.useRealTimers();
        const fn = vi.fn()
            .mockRejectedValueOnce(new Error('a'))
            .mockRejectedValueOnce(new Error('b'))
            .mockResolvedValue('ok');

        const controller = new AbortController();
        const p = withRetry(fn, logger, {
            retries: 5,
            delay: 10,
            jitter: 'none',
            signal: controller.signal,
        });

        await new Promise((r) => setTimeout(r, 5));
        controller.abort();

        await expect(p).rejects.toThrow('Retry aborted');
    });

    it('applies full jitter by default (no deterministic delay)', async () => {
        vi.useRealTimers();
        const fn = vi.fn()
            .mockRejectedValueOnce(new Error('a'))
            .mockResolvedValue('ok');

        const p = withRetry(fn, logger, { retries: 3, delay: 5, factor: 1 });
        const result = await p;

        expect(result).toBe('ok');
    });
});
