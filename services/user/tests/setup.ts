import { vi } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.PORT = '4001';
process.env.JWT_SECRET = 'test-jwt-secret-key-123';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';

vi.mock('ioredis', () => {
    const Redis = vi.fn();
    Redis.prototype.on = vi.fn();
    Redis.prototype.quit = vi.fn();
    Redis.prototype.disconnect = vi.fn();
    Redis.prototype.get = vi.fn();
    Redis.prototype.set = vi.fn();
    Redis.prototype.del = vi.fn();
    return { default: Redis };
});

vi.mock('pino', () => {
    return {
        default: () => ({
            info: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
            warn: vi.fn(),
            fatal: vi.fn(),
            child: () => ({
                info: vi.fn(),
                error: vi.fn(),
                debug: vi.fn(),
                warn: vi.fn(),
                fatal: vi.fn(),
            }),
        }),
    };
});

vi.mock('../src/lib/metrics', () => ({
    metrics: {
        httpRequestDuration: { observe: vi.fn() },
        cacheOperations: { inc: vi.fn() },
        dbOperations: { 
            startTimer: vi.fn().mockReturnValue(() => {}),
        },
        register: {
            contentType: 'text/plain',
            metrics: vi.fn().mockResolvedValue(''),
        }
    }
}));