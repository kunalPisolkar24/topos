import { randomUUID } from 'crypto';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ILogger } from '../../core/interfaces/logger.interface.js';

export const REQUEST_ID_HEADER = 'X-Request-Id';

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;

const generateRequestId = (): string => randomUUID().replace(/-/g, '');

export interface RequestIdOptions {
    logger: ILogger;
    header?: string;
}

export const requestId = ({ logger, header = REQUEST_ID_HEADER }: RequestIdOptions): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const incoming = req.header(header);
        const id = incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : generateRequestId();

        (req as Request & { id: string; log: ILogger }).id = id;
        (req as Request & { log: ILogger }).log = logger.child({ requestId: id });

        res.setHeader(header, id);
        next();
    };
};
