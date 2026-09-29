#!/usr/bin/env node
// One-time-per-deploy bootstrap for the AI checkpoint database.
//
// The shared RDS/Postgres instance only creates the initial database
// (topos_users). This script ensures the least-privilege ai_checkpointer
// role and the ai_checkpoints database exist before `prisma migrate deploy`
// runs. It is idempotent: every check is existence-guarded and a lost
// CREATE DATABASE race (42P04) is treated as success, so the user-migrator
// can run it on every deploy in docker and prod.
//
// Env (canonical first, then fallbacks):
//   DATABASE_URL_MIGRATE | USER_DATABASE_URL_MIGRATE  master connection
//     (direct writer in prod; never a pooled URL — DDL pins poolers)
//   AI_CHECKPOINTER_PASSWORD | USER_AI_CHECKPOINTER_PASSWORD
//     | AI_POSTGRES_PASSWORD                              (required)
//   AI_CHECKPOINTER_USER | USER_AI_CHECKPOINTER_USER | AI_POSTGRES_USER
//   AI_CHECKPOINT_DB | USER_AI_CHECKPOINT_DB | AI_POSTGRES_DB
//
// Missing migrate URL or AI password means "nothing to do" (e.g. the
// loadtest stack or a postgres-less run): the script logs and exits 0.
// Any other failure warns and continues so user-schema migrations are
// never blocked by the AI store; the ai-service retry loop surfaces
// a genuinely unreachable database via its own health checks.

import { pathToFileURL } from 'node:url';
import { Client } from 'pg';

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_$]*$/;

function firstPresent(env, names) {
  for (const name of names) {
    const value = env[name];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value);
    }
  }
  return undefined;
}

export function parseConfig(env = process.env) {
  const migrateUrl = firstPresent(env, ['DATABASE_URL_MIGRATE', 'USER_DATABASE_URL_MIGRATE']);
  if (!migrateUrl) {
    return { skip: 'no DATABASE_URL_MIGRATE set' };
  }
  const aiPassword = firstPresent(env, [
    'AI_CHECKPOINTER_PASSWORD',
    'USER_AI_CHECKPOINTER_PASSWORD',
    'AI_POSTGRES_PASSWORD',
  ]);
  if (!aiPassword) {
    return { skip: 'no AI checkpointer password set' };
  }
  return {
    migrateUrl,
    aiUser:
      firstPresent(env, ['AI_CHECKPOINTER_USER', 'USER_AI_CHECKPOINTER_USER', 'AI_POSTGRES_USER']) ??
      'ai_checkpointer',
    aiPassword,
    aiDb:
      firstPresent(env, ['AI_CHECKPOINT_DB', 'USER_AI_CHECKPOINT_DB', 'AI_POSTGRES_DB']) ??
      'ai_checkpoints',
  };
}

function assertIdentifier(value, label) {
  if (!IDENTIFIER_RE.test(value)) {
    throw new Error(`invalid ${label}: ${value}`);
  }
}

export async function bootstrapAiDatabase(client, { aiUser, aiPassword, aiDb }) {
  assertIdentifier(aiUser, 'AI role name');
  assertIdentifier(aiDb, 'AI database name');

  // Passwords cannot be query parameters in utility statements (CREATE /
  // ALTER ROLE), so ask the server to quote the literal once and embed the
  // quoted form in a top-level statement, where it is parsed exactly once
  // as literal syntax. (Embedding it via format() %s inside a DO block
  // would re-parse it and strip the quoting.) quote_literal output is safe
  // to embed: the server doubles single quotes itself.
  const quoted = await client.query('SELECT quote_literal($1) AS quoted', [aiPassword]);
  const quotedPassword = quoted.rows[0].quoted;

  const roleExists = await client.query('SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = $1', [
    aiUser,
  ]);
  if (roleExists.rowCount === 0) {
    try {
      await client.query(`CREATE ROLE "${aiUser}" LOGIN PASSWORD ${quotedPassword}`);
    } catch (err) {
      if (err?.code !== '42710') {
        throw err;
      }
      // Lost a CREATE race with another migrator replica; the role
      // exists now, which is all we needed.
    }
  } else {
    await client.query(`ALTER ROLE "${aiUser}" WITH LOGIN PASSWORD ${quotedPassword}`);
  }

  const existing = await client.query('SELECT 1 FROM pg_catalog.pg_database WHERE datname = $1', [
    aiDb,
  ]);
  if (existing.rowCount === 0) {
    try {
      await client.query(`CREATE DATABASE "${aiDb}" OWNER "${aiUser}"`);
    } catch (err) {
      if (err?.code !== '42P04') {
        throw err;
      }
      // Lost a CREATE race with another migrator replica; the database
      // exists now, which is all we needed.
    }
  }

  await client.query(`GRANT ALL PRIVILEGES ON DATABASE "${aiDb}" TO "${aiUser}"`);
}

async function main() {
  const config = parseConfig(process.env);
  if (config.skip) {
    console.log(`[bootstrap-ai-db] skip: ${config.skip}`);
    return;
  }
  const client = new Client({
    connectionString: config.migrateUrl,
    application_name: 'user-migrator-bootstrap',
  });
  try {
    await client.connect();
    await bootstrapAiDatabase(client, config);
    console.log(`[bootstrap-ai-db] ensured role "${config.aiUser}" and database "${config.aiDb}"`);
  } catch (err) {
    console.warn(
      `[bootstrap-ai-db] warning: ${err instanceof Error ? err.message : String(err)} (continuing to migrations)`,
    );
  } finally {
    await client.end().catch(() => {});
  }
}

const invokedAsMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedAsMain) {
  await main();
}
