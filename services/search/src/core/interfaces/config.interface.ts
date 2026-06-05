export type Algorithm = 'RS256' | 'RS384' | 'RS512' | 'ES256' | 'ES384' | 'ES512' | 'HS256' | 'HS384' | 'HS512' | 'PS256' | 'PS384' | 'PS512';

export interface IConfig {
  service: {
    name: string;
    version: string;
    env: 'development' | 'production' | 'test';
  };
  api?: {
    port: number;
  };
  worker?: {
    metricsPort: number;
  };
  elasticsearch: {
    url: string;
    index: string;
    tlsRejectUnauthorized: boolean;
    requestTimeoutMs: number;
    maxRetries: number;
    refreshPolicy: 'false' | 'true' | 'wait_for';
    bulkChunkSize: number;
  };
  redis: {
    url?: string;
    sentinelHosts?: Array<{ host: string; port: number }>;
    sentinelMasterName: string;
    password?: string;
    sentinelPassword?: string;
    sentinelTls?: boolean;
  };
  kafka?: {
    brokers: string[];
    clientId: string;
    groupId: string;
    topicPosts: string;
    topicDlq: string;
    fromBeginning: boolean;
    partitionsConcurrent: number;
    sessionTimeoutMs: number;
    heartbeatIntervalMs: number;
  };
  cache: {
    defaultTtlSeconds: number;
    maxQueryLength: number;
  };
  auth: {
    enabled: boolean;
    jwksUri?: string;
    audience?: string;
    issuer?: string;
    algorithms: Algorithm[];
    cacheMaxAgeMs: number;
    clockToleranceSec: number;
  };
  metrics: {
    basicAuth?: { username: string; password: string };
  };
  http: {
    corsOrigins: string[];
    bodyLimitKb: number;
    trustProxy: boolean;
  };
  shutdown: {
    timeoutMs: number;
  };
  logging: {
    level: string;
  };
}
