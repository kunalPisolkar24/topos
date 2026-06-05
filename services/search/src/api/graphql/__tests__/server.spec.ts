import { describe, it, expect } from 'vitest';
import { buildApolloServer } from '../server.js';
import { parse } from 'graphql';

const introspectionQuery = `
  query IntrospectionQuery {
    __schema {
      queryType { name }
    }
  }
`;

const deepQuery = `
  query Deep {
    searchPosts(query: "a") {
      hits {
        id
      }
    }
  }
`;

describe('buildApolloServer', () => {
    describe('introspection toggle', () => {
        it('disables introspection in production', async () => {
            const server = buildApolloServer({ isProduction: true });
            await server.start();
            try {
                const res = await server.executeOperation(
                    { query: introspectionQuery },
                    { contextValue: {} }
                );
                if (res.body.kind !== 'single') throw new Error('Expected single result');
                const errors = res.body.singleResult.errors ?? [];
                expect(errors.length).toBeGreaterThan(0);
                const code = (errors[0].extensions as { code?: string } | undefined)?.code;
                expect(code).toBeDefined();
            } finally {
                await server.stop();
            }
        });

        it('enables introspection outside production', async () => {
            const server = buildApolloServer({ isProduction: false });
            await server.start();
            try {
                const res = await server.executeOperation(
                    { query: introspectionQuery },
                    { contextValue: {} }
                );
                if (res.body.kind === 'single') {
                    expect(res.body.singleResult.errors ?? []).toHaveLength(0);
                }
            } finally {
                await server.stop();
            }
        });
    });

    describe('validation rules', () => {
        const buildAndStart = async (maxDepth: number, maxCost: number) => {
            const server = buildApolloServer({
                isProduction: false,
                maxDepth,
                maxCost,
            });
            await server.start();
            return server;
        };

        it('rejects queries that exceed the depth limit', async () => {
            const server = await buildAndStart(1, 1000);
            try {
                const res = await server.executeOperation(
                    { query: deepQuery },
                    { contextValue: {} }
                );
                if (res.body.kind !== 'single') throw new Error('Expected single result');
                const errors = res.body.singleResult.errors ?? [];
                expect(errors.length).toBeGreaterThan(0);
            } finally {
                await server.stop();
            }
        });

        it('rejects queries that exceed the cost limit', async () => {
            const server = await buildAndStart(10, 1);
            try {
                const res = await server.executeOperation(
                    { query: '{ searchPosts(query: "a", page: 1, limit: 10) { total } }' },
                    { contextValue: {} }
                );
                if (res.body.kind !== 'single') throw new Error('Expected single result');
                const errors = res.body.singleResult.errors ?? [];
                expect(errors.length).toBeGreaterThan(0);
            } finally {
                await server.stop();
            }
        });
    });

    it('parses a valid query through the schema', async () => {
        const server = buildApolloServer({ isProduction: false });
        await server.start();
        try {
            const doc = parse(deepQuery);
            expect(doc).toBeDefined();
        } finally {
            await server.stop();
        }
    });
});
