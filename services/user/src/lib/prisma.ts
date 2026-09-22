import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { env } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { logger } from '../observability/logger.js';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30_000,
  max: 10,
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
