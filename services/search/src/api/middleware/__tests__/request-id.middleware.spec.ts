import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';
import { Request, Response, NextFunction } from 'express';
import { requestId } from '../request-id.middleware.js';
import { ILogger } from '../../../core/interfaces/logger.interface.js';

const runMiddleware = (mw: ReturnType<typeof requestId>, req: Partial<Request>) => {
    const res: Partial<Response> = {
        setHeader: vi.fn().mockReturnThis(),
    };
    const next = vi.fn() as unknown as NextFunction;
    mw(req as Request, res as Response, next);
    return { res: res as Response, next };
};

describe('requestId middleware', () => {
    let logger: MockProxy<ILogger>;
    let childLogger: MockProxy<ILogger>;

    beforeEach(() => {
        childLogger = mock<ILogger>();
        logger = mock<ILogger>();
        logger.child.mockReturnValue(childLogger);
    });

    it('uses the supplied X-Request-Id when it matches the pattern', () => {
        const mw = requestId({ logger });
        const req = { header: vi.fn().mockReturnValue('abc12345') } as Partial<Request>;
        const { res, next } = runMiddleware(mw, req);

        expect((req as any).id).toBe('abc12345');
        expect((req as any).log).toBe(childLogger);
        expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', 'abc12345');
        expect(next).toHaveBeenCalled();
        expect(logger.child).toHaveBeenCalledWith({ requestId: 'abc12345' });
    });

    it('rejects a malformed inbound id and generates a new one', () => {
        const mw = requestId({ logger });
        const req = { header: vi.fn().mockReturnValue('short') } as Partial<Request>;
        const { res } = runMiddleware(mw, req);

        const id = (req as any).id as string;
        expect(id).toMatch(/^[a-f0-9]{32}$/);
        expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', id);
    });

    it('generates a fresh id when the header is missing', () => {
        const mw = requestId({ logger });
        const req = { header: vi.fn().mockReturnValue(undefined) } as Partial<Request>;
        const { res } = runMiddleware(mw, req);

        const id = (req as any).id as string;
        expect(id).toMatch(/^[a-f0-9]{32}$/);
        expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', id);
    });

    it('respects a custom header name', () => {
        const mw = requestId({ logger, header: 'X-Correlation-Id' });
        const req = { header: vi.fn().mockReturnValue('correlation-1234567890') } as Partial<Request>;
        const { res } = runMiddleware(mw, req);

        expect((req as any).id).toBe('correlation-1234567890');
        expect(res.setHeader).toHaveBeenCalledWith('X-Correlation-Id', 'correlation-1234567890');
    });
});
