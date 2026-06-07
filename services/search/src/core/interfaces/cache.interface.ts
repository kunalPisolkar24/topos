export interface ICacheService {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    get(key: string): Promise<string | null>;
    set(key: string, value: string, ttlSeconds?: number): Promise<void>;
    delete(key: string): Promise<void>;
    ping(): Promise<void>;
}
