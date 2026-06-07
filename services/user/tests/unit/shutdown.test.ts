import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { ShutdownManager, ShutdownCloser } from '../../src/lib/shutdown';
import { logger } from '../../src/lib/logger';

class FakeServer extends EventEmitter {
    close = vi.fn((cb: (err?: Error) => void) => cb());
    closeAllConnections = vi.fn();
}

describe('ShutdownManager', () => {
    let server: FakeServer;
    let closers: ShutdownCloser[];
    let exitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        server = new FakeServer();
        closers = [];
        exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('registers SIGTERM and SIGINT listeners on construction', () => {
        const count = process.listenerCount('SIGTERM') + process.listenerCount('SIGINT');
        new ShutdownManager(server as any, [], 1_000);
        expect(process.listenerCount('SIGTERM') + process.listenerCount('SIGINT')).toBeGreaterThanOrEqual(count + 2);
    });

    it('closes the http server and runs all closers on SIGTERM', async () => {
        const calls: string[] = [];
        closers.push(
            { name: 'cache', close: vi.fn(async () => { calls.push('cache'); }) },
            { name: 'database', close: vi.fn(async () => { calls.push('database'); }) }
        );

        void new ShutdownManager(server as any, closers, 5_000);
        process.emit('SIGTERM');

        await new Promise((r) => setImmediate(r));
        expect(server.close).toHaveBeenCalled();
        expect(calls).toEqual(['cache', 'database']);
        expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('continues running closers when one fails', async () => {
        const calls: string[] = [];
        closers.push(
            { name: 'failing', close: vi.fn(async () => { calls.push('failing'); throw new Error('boom'); }) },
            { name: 'ok', close: vi.fn(async () => { calls.push('ok'); }) }
        );

        new ShutdownManager(server as any, closers, 5_000);
        process.emit('SIGTERM');

        await new Promise((r) => setImmediate(r));
        expect(calls).toEqual(['failing', 'ok']);
    });

    it('force-exits with code 1 on signal when shutdown throws', async () => {
        server.close = vi.fn((cb: (err?: Error) => void) => cb(new Error('http close failed')));
        new ShutdownManager(server as any, [], 5_000);

        process.emit('SIGTERM');
        await new Promise((r) => setImmediate(r));
        expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('ignores duplicate signals while a shutdown is already in flight', async () => {
        const cacheClose = vi.fn(async () => {
            await new Promise((r) => setTimeout(r, 10));
        });
        closers.push({ name: 'cache', close: cacheClose });
        new ShutdownManager(server as any, closers, 5_000);

        process.emit('SIGTERM');
        process.emit('SIGTERM');
        process.emit('SIGINT');

        await new Promise((r) => setTimeout(r, 30));
        expect(cacheClose).toHaveBeenCalledTimes(1);
        expect(exitSpy).toHaveBeenCalledTimes(1);
    });

    it('logs the start and end of the shutdown sequence', async () => {
        const infoSpy = vi.spyOn(logger, 'info');
        new ShutdownManager(server as any, [], 5_000);
        process.emit('SIGTERM');
        await new Promise((r) => setImmediate(r));
        const messages = infoSpy.mock.calls.map((c) => (c[0] as { msg: string }).msg);
        expect(messages.some((m) => m.includes('SIGTERM'))).toBe(true);
        expect(messages).toContain('Graceful shutdown completed');
    });
});
