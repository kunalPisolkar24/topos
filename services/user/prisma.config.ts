import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// MIGRATE_URL resolution (first present wins):
//   DATABASE_URL_MIGRATE | USER_DATABASE_URL_MIGRATE (direct writer; never
//   a pooler — DDL pins poolers) | DATABASE_URL | USER_DATABASE_URL.
// The migrator runner (scripts/migrator-run.mjs) hydrates SM/SSM into these
// vars before invoking the CLI, so Floci/AWS need no extra handling here.
const migrateUrl =
  process.env.DATABASE_URL_MIGRATE ??
  process.env.USER_DATABASE_URL_MIGRATE ??
  process.env.DATABASE_URL ??
  process.env.USER_DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: migrateUrl,
  },
});
