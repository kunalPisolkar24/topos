import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: ['node_modules/', 'dist/', 'src/integration/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        'src/config/**',
        'src/app-api.ts',
        'src/app-worker.ts',
        'src/infrastructure/kafka/dlq.producer.ts',
        'src/core/interfaces/**',
        'src/core/entities/**',
        'src/api/graphql/schema.ts'
      ],
    },
  },
});