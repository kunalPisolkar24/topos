import client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
    registers: [register],
});

const cacheOperations = new client.Counter({
    name: 'cache_operations_total',
    help: 'Total number of cache operations',
    labelNames: ['type', 'status'],
    registers: [register],
});

const dbOperations = new client.Histogram({
    name: 'db_operation_duration_seconds',
    help: 'Duration of database operations',
    labelNames: ['operation', 'model'],
    buckets: [0.05, 0.1, 0.2, 0.5, 1, 2],
    registers: [register],
});

const graphqlOperationDuration = new client.Histogram({
    name: 'graphql_operation_duration_seconds',
    help: 'Duration of GraphQL operations in seconds',
    labelNames: ['operation', 'kind', 'status'],
    buckets: [0.05, 0.1, 0.2, 0.5, 1, 2, 5],
    registers: [register],
});

export const metrics = {
    register,
    httpRequestDuration,
    cacheOperations,
    dbOperations,
    graphqlOperationDuration,
};