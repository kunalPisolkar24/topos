# Frontend testing

Run commands from `frontend/`:

```bash
npm test
npm run test:watch
npm run test:coverage
npm run test:integration
npm run lint
npm run build
```

Unit tests run with Vitest and exclude integration-named files. Integration
tests are run explicitly. Build runs GraphQL generation, TypeScript checking,
and Vite production output, making it a useful final verification after schema
or frontend-contract changes.
