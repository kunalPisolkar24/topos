# User service testing

Run commands from `services/user/`:

```bash
npm test
npm run test:integration
npm run test:coverage
npm run lint
npm run db:generate
```

Integration tests use Testcontainers and need Docker. Run Prisma generation
after changing `prisma/schema.prisma`; generated client code is not edited by
hand.
