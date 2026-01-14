import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg'
import { readReplicas } from '@prisma/extension-read-replicas'
import { Pool } from 'pg'

const mainAdapter = new PrismaPg(
  new Pool({ connectionString: process.env.DATABASE_URL_MIGRATE }),
)

const replicaAdapter = new PrismaPg(
  new Pool({ connectionString: process.env.DATABASE_URL_REPLICA }),
)

const replicaClient = new PrismaClient({ adapter: replicaAdapter })

const prisma = new PrismaClient({ adapter: mainAdapter }).$extends(
  readReplicas({
    replicas: [replicaClient],
  }),
)