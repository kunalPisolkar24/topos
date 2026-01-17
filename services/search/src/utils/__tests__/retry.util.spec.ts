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

    it('should return result on first successful attempt', async () => {
        const fn = vi.fn().mockResolvedValue('success');

        const resultPromise = withRetry(fn, logger, { retries: 3, delay: 100 });
        const result = await resultPromise;

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(new Error('Fail 1'))
            .mockResolvedValue('success');

        const resultPromise = withRetry(fn, logger, { retries: 3, delay: 100 });

        await vi.advanceTimersByTimeAsync(100);
        const result = await resultPromise;

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
        expect(logger.warn).toHaveBeenCalledWith('Operation failed, retrying...', expect.objectContaining({
            attempt: 1,
            maxRetries: 3
        }));
    });

    it('should throw after exhausting retries', async () => {
        vi.useRealTimers();
        const fn = vi.fn().mockRejectedValue(new Error('Always Fail'));

        await expect(withRetry(fn, logger, { retries: 2, delay: 10 })).rejects.toThrow('Always Fail');
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should apply exponential backoff with factor', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(new Error('Fail 1'))
            .mockRejectedValueOnce(new Error('Fail 2'))
            .mockResolvedValue('success');

        const resultPromise = withRetry(fn, logger, { retries: 3, delay: 100, factor: 2 });

        await vi.advanceTimersByTimeAsync(100);
        expect(fn).toHaveBeenCalledTimes(2);

        await vi.advanceTimersByTimeAsync(200);
        const result = await resultPromise;

        expect(fn).toHaveBeenCalledTimes(3);
        expect(result).toBe('success');
    });

    it('should use default options when not provided', async () => {
        const fn = vi.fn().mockResolvedValue('success');

        const result = await withRetry(fn, logger);

        expect(result).toBe('success');
    });

    it('should include error message in retry log', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(new Error('Specific Error'))
            .mockResolvedValue('success');

        const resultPromise = withRetry(fn, logger, { retries: 3, delay: 100 });
        await vi.advanceTimersByTimeAsync(100);
        await resultPromise;

        expect(logger.warn).toHaveBeenCalledWith('Operation failed, retrying...', expect.objectContaining({
            error: 'Specific Error'
        }));
    });
});
