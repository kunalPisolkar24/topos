import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { env } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { logger } from '../observability/logger.js';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // Tunable via SSM /topos/user/config (prod) or USER_PG_* (local).
  // pg parses ?sslmode=require from the URL into verified TLS (system CA
  // bundle in the runtime image covers the public RDS cert), which the
  // proxy's require_tls demands. No SET-based options here on purpose:
  // SET pins RDS Proxy sessions and would defeat pooling.
  connectionTimeoutMillis: env.PG_POOL_CONNECTION_TIMEOUT_MS,
  idleTimeoutMillis: env.PG_POOL_IDLE_TIMEOUT_MS,
  max: env.PG_POOL_MAX,
  application_name: 'user-service',
});

pool.on('error', (err: Error) => {
  logger.error({ error: err.message, stack: err.stack }, 'pg pool error');
});

export const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

export async function closeDb(): Promise<void> {
  try {
    await prisma.$disconnect();
  } finally {
    try {
      await pool.end();
    } catch {
      // pool already closed
    }
  }
}

export async function pingDb(): Promise<'ok' | 'unavailable'> {
  try {
    await Promise.race([
      pool.query('SELECT 1'),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('db ping timed out')), 3000),
      ),
    ]);
    return 'ok';
  } catch {
    return 'unavailable';
  }
}
