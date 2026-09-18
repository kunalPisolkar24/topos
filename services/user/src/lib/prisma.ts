import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { env } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});

export const primaryPool = pool;

export const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

export function primaryDb(): PrismaClient {
  return prisma;
}

export async function closeDb(): Promise<void> {
  await prisma.$disconnect();
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
