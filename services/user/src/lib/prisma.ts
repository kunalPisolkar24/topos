import { PrismaClient } from '../generated/prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';
import { env } from '../config/env';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const prisma = globalForPrisma.prisma || new PrismaClient({
    accelerateUrl: env.DATABASE_URL,
}).$extends(withAccelerate());

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma as unknown as PrismaClient;

export default prisma;