import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { readReplicas } from '@prisma/extension-read-replicas';
import { PrismaClient } from '../generated/prisma/client';
import { env } from '../config/env';

const pool = new Pool({ connectionString: env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const baseClient = new PrismaClient({ adapter });

const client = env.DATABASE_URL_REPLICA
    ? baseClient.$extends(
        readReplicas({
            replicas: [
                new PrismaClient({
                    adapter: new PrismaPg(
                        new Pool({ connectionString: env.DATABASE_URL_REPLICA })
                    ),
                }),
            ],
        })
    )
    : baseClient;

export default client as unknown as PrismaClient;