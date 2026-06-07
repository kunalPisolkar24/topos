import type { JWTPayload } from 'jose';

export interface Viewer {
    id: string;
    scopes: string[];
    token: JWTPayload;
}

export interface IAuthVerifier {
    verify(token: string): Promise<Viewer>;
}
