import { RequestHandler } from 'express';
import helmet from 'helmet';

export interface SecurityHeadersOptions {
    isProduction: boolean;
}

export const securityHeaders = ({
    isProduction,
}: SecurityHeadersOptions): RequestHandler => {
    return helmet({
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        referrerPolicy: { policy: 'no-referrer' },
        frameguard: { action: 'deny' },
        strictTransportSecurity: isProduction
            ? {
                  maxAge: 60 * 60 * 24 * 365,
                  includeSubDomains: true,
                  preload: false,
              }
            : { maxAge: 0 },
    });
};
