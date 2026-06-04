import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { faker } from '@faker-js/faker';
import crypto from 'node:crypto';
import { PrismaClient } from '../../src/generated/prisma/client';
import { passwordHasher } from '../../src/utils/passwordHasher';
import { tokenService } from '../../src/utils/tokenService';
import { normalizeEmail, normalizeUsername } from '../../src/utils/normalize';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const SEED_USER_COUNT = parseInt(process.env.SEED_USER_COUNT ?? '5000', 10);
const BATCH_SIZE = 500;
const OUTPUT_DIR = process.env.SEED_OUTPUT_DIR ?? '/out';

interface SeedUser {
    id: number;
    email: string;
    username: string;
    password: string;
}

function randomSuffix(): string {
    return faker.string.alphanumeric({ length: 8, casing: 'lower' });
}

function genPassword(suffix: string): string {
    const hex = crypto.createHash('sha256').update(`loadtest:${suffix}`).digest('hex');
    return `Lt${hex.slice(0, 28)}`;
}

function genCredentials(suffix: string): { email: string; username: string; password: string } {
    const email = normalizeEmail(`lt_${suffix}@loadtest.local`);
    const username = normalizeUsername(`lt_user_${suffix}`.slice(0, 30));
    const password = genPassword(suffix);
    return { email, username, password };
}

async function ensureSeedUsers(prisma: PrismaClient, count: number): Promise<void> {
    const existing = await prisma.user.count();
    if (existing >= count) {
        console.log(`[seed] users already present: ${existing} >= ${count}, skipping insert`);
        return;
    }

    const toInsert = count - existing;
    console.log(`[seed] inserting ${toInsert} users (existing=${existing}, target=${count})`);

    let inserted = 0;
    let batch: Array<{ email: string; username: string; passwordHash: string; name: string }> = [];

    for (let i = 0; i < toInsert; i++) {
        const rawSuffix = `${Date.now()}_${i}_${randomSuffix()}`;
        const suffix = rawSuffix.slice(0, 22);
        const { email, username, password } = genCredentials(suffix);
        const passwordHash = await passwordHasher.hash(password);
        batch.push({ email, username, passwordHash, name: username });
        if (batch.length >= BATCH_SIZE) {
            await flushBatch(prisma, batch);
            inserted += batch.length;
            batch = [];
            if (inserted % 1000 === 0 || inserted === toInsert) {
                console.log(`[seed]   inserted ${inserted}/${toInsert}`);
            }
        }
    }
    if (batch.length > 0) {
        await flushBatch(prisma, batch);
        inserted += batch.length;
        console.log(`[seed]   inserted ${inserted}/${toInsert}`);
    }
}

async function flushBatch(
    prisma: PrismaClient,
    batch: Array<{ email: string; username: string; passwordHash: string; name: string }>
): Promise<void> {
    await prisma.$transaction(
        batch.map((row) =>
            prisma.user.create({
                data: {
                    email: row.email,
                    username: row.username,
                    password: row.passwordHash,
                    name: row.name,
                },
                select: { id: true },
            })
        ),
        { timeout: 60_000 }
    );
}

async function loadSeedUsers(prisma: PrismaClient, count: number): Promise<SeedUser[]> {
    const rows = await prisma.user.findMany({
        take: count,
        orderBy: { id: 'asc' },
        select: { id: true, email: true, username: true },
    });

    if (rows.length < count) {
        throw new Error(`[seed] expected ${count} users, found ${rows.length}`);
    }

    return rows.map((row) => {
        const suffix = row.username.replace(/^lt_user_/, '');
        const { password } = genCredentials(suffix);
        return { id: row.id, email: row.email, username: row.username, password };
    });
}

async function main(): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error('DATABASE_URL is required');
    }

    const pool = new Pool({ connectionString: databaseUrl, max: 10 });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    const startedAt = Date.now();
    try {
        await ensureSeedUsers(prisma, SEED_USER_COUNT);
        const users = await loadSeedUsers(prisma, SEED_USER_COUNT);
        const tokens = users.map((u) => tokenService.sign({ id: u.id }));

        await mkdir(OUTPUT_DIR, { recursive: true });
        await writeFile(
            path.join(OUTPUT_DIR, 'users.json'),
            JSON.stringify(users),
            'utf8'
        );
        await writeFile(
            path.join(OUTPUT_DIR, 'tokens.json'),
            JSON.stringify(tokens),
            'utf8'
        );

        const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
        console.log(`[seed] wrote ${users.length} users + tokens to ${OUTPUT_DIR} in ${elapsed}s`);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

main().catch((err) => {
    console.error('[seed] failed:', err);
    process.exit(1);
});
