import client from 'prom-client';

export class MetricsRegistry {
    private static instance: MetricsRegistry;
    public readonly register: client.Registry;

    public readonly httpRequestDuration: client.Histogram;
    public readonly cacheOperations: client.Counter;
    public readonly dbOperations: client.Histogram;

    private constructor() {
        this.register = new client.Registry();
        
        client.collectDefaultMetrics({ register: this.register });

        this.httpRequestDuration = new client.Histogram({
            name: 'http_request_duration_seconds',
            help: 'Duration of HTTP requests in seconds',
            labelNames: ['method', 'route', 'status_code'],
            buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
            registers: [this.register]
        });

        this.cacheOperations = new client.Counter({
            name: 'cache_operations_total',
            help: 'Total number of cache operations',
            labelNames: ['type', 'status'],
            registers: [this.register]
        });

        this.dbOperations = new client.Histogram({
            name: 'db_operation_duration_seconds',
            help: 'Duration of database operations',
            labelNames: ['operation', 'model'],
            buckets: [0.05, 0.1, 0.2, 0.5, 1, 2],
            registers: [this.register]
        });
    }

    public static getInstance(): MetricsRegistry {
        if (!MetricsRegistry.instance) {
            MetricsRegistry.instance = new MetricsRegistry();
        }
        return MetricsRegistry.instance;
    }
}

export const metrics = MetricsRegistry.getInstance();