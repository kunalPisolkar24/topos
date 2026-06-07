import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { ILogger } from '../../core/interfaces/logger.interface.js';
import { withTimeout, runShutdown } from '../shutdown.util.js';

describe('withTimeout', () => {
    it('returns the operation result when it completes in time', async () => {
        const result = await withTimeout(async () => 'ok', 50, 'op');
        expect(result).toBe('ok');
    });

    it('returns undefined and warns when the operation exceeds the timeout', async () => {
        const logger = mock<ILogger>();
        const result = await withTimeout(() => new Promise(() => {}), 10, 'slow', logger);
        expect(result).toBeUndefined();
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("'slow'"));
    });

    it('clears the timer even if the operation rejects', async () => {
        await expect(
            withTimeout(async () => { throw new Error('boom'); }, 1000, 'op')
        ).rejects.toThrow('boom');
    });
});

describe('runShutdown', () => {
    it('runs every step in order and swallows individual failures', async () => {
        const logger = mock<ILogger>();
        const calls: string[] = [];
        await runShutdown(
            [
                { name: 'a', run: async () => { calls.push('a'); } },
                { name: 'b', run: async () => { throw new Error('b broken'); } },
                { name: 'c', run: async () => { calls.push('c'); } },
            ],
            logger,
            1000
        );
        expect(calls).toEqual(['a', 'c']);
        expect(logger.error).toHaveBeenCalledWith(
            "Shutdown step 'b' failed",
            expect.objectContaining({ error: 'b broken' })
        );
    });
});
