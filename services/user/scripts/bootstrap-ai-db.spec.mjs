import { describe, it, expect } from 'vitest';
import { parseConfig, bootstrapAiDatabase } from './bootstrap-ai-db.mjs';

function fakeClient(handler) {
  const queries = [];
  return {
    queries,
    async query(text, params) {
      queries.push({ text, params });
      return handler(text, params, queries.length);
    },
  };
}

const QUOTED = { rows: [{ quoted: "'s3cret'" }] };

describe('parseConfig', () => {
  it('reads canonical vars', () => {
    const config = parseConfig({
      DATABASE_URL_MIGRATE: 'postgresql://m:m@writer:5432/topos_users',
      AI_CHECKPOINTER_PASSWORD: 'pw',
    });
    expect(config).toMatchObject({
      migrateUrl: 'postgresql://m:m@writer:5432/topos_users',
      aiUser: 'ai_checkpointer',
      aiPassword: 'pw',
      aiDb: 'ai_checkpoints',
    });
  });

  it('falls back to docker-style aliases', () => {
    const config = parseConfig({
      USER_DATABASE_URL_MIGRATE: 'postgresql://m:m@user-postgres:5432/topos_users',
      AI_POSTGRES_PASSWORD: 'pw',
      AI_POSTGRES_USER: 'custom_role',
      AI_POSTGRES_DB: 'custom_db',
    });
    expect(config).toMatchObject({
      aiUser: 'custom_role',
      aiPassword: 'pw',
      aiDb: 'custom_db',
    });
  });

  it('skips without a migrate URL', () => {
    expect(parseConfig({ AI_CHECKPOINTER_PASSWORD: 'pw' }).skip).toMatch(/DATABASE_URL_MIGRATE/);
  });

  it('skips without an AI password', () => {
    expect(
      parseConfig({ DATABASE_URL_MIGRATE: 'postgresql://m:m@h:5432/d' }).skip,
    ).toMatch(/password/);
  });
});

describe('bootstrapAiDatabase', () => {
  const config = { aiUser: 'ai_checkpointer', aiPassword: 'pw', aiDb: 'ai_checkpoints' };

  it('creates role and database on a fresh install', async () => {
    const client = fakeClient((text) => {
      if (text.startsWith('SELECT quote_literal')) return QUOTED;
      if (text.includes('pg_database')) return { rowCount: 0, rows: [] };
      return { rowCount: 0, rows: [] };
    });

    await bootstrapAiDatabase(client, config);

    const statements = client.queries.map((q) => q.text);
    expect(statements).toHaveLength(6);
    expect(statements[2]).toContain('CREATE ROLE "ai_checkpointer" LOGIN PASSWORD');
    expect(statements[4]).toContain('CREATE DATABASE "ai_checkpoints" OWNER "ai_checkpointer"');
    expect(statements[5]).toContain('GRANT ALL PRIVILEGES ON DATABASE "ai_checkpoints"');
  });

  it('alters the role and skips CREATEs when everything exists', async () => {
    const client = fakeClient((text) => {
      if (text.startsWith('SELECT quote_literal')) return QUOTED;
      if (text.includes('pg_roles') || text.includes('pg_database')) {
        return { rowCount: 1, rows: [{ '?column?': 1 }] };
      }
      return { rowCount: 0, rows: [] };
    });

    await bootstrapAiDatabase(client, config);

    const statements = client.queries.map((q) => q.text);
    expect(statements.some((s) => s.startsWith('CREATE ROLE'))).toBe(false);
    expect(statements.some((s) => s.startsWith('CREATE DATABASE'))).toBe(false);
    expect(statements.some((s) => s.startsWith('ALTER ROLE "ai_checkpointer"'))).toBe(true);
    expect(statements.some((s) => s.startsWith('GRANT ALL PRIVILEGES'))).toBe(true);
  });

  it('treats a lost CREATE DATABASE race (42P04) as success', async () => {
    const client = fakeClient((text) => {
      if (text.startsWith('SELECT quote_literal')) return QUOTED;
      if (text.includes('pg_database')) return { rowCount: 0, rows: [] };
      if (text.startsWith('CREATE DATABASE')) {
        throw Object.assign(new Error('database already exists'), { code: '42P04' });
      }
      return { rowCount: 0, rows: [] };
    });

    await expect(bootstrapAiDatabase(client, config)).resolves.toBeUndefined();
    expect(client.queries.at(-1).text).toContain('GRANT ALL PRIVILEGES');
  });

  it('treats a lost CREATE ROLE race (42710) as success', async () => {
    const client = fakeClient((text) => {
      if (text.startsWith('SELECT quote_literal')) return QUOTED;
      if (text.includes('pg_database')) return { rowCount: 1, rows: [{ '?column?': 1 }] };
      if (text.startsWith('CREATE ROLE')) {
        throw Object.assign(new Error('role already exists'), { code: '42710' });
      }
      return { rowCount: 0, rows: [] };
    });

    await expect(bootstrapAiDatabase(client, config)).resolves.toBeUndefined();
    expect(client.queries.at(-1).text).toContain('GRANT ALL PRIVILEGES');
  });

  it('rethrows non-race errors', async () => {
    const client = fakeClient((text) => {
      if (text.startsWith('SELECT quote_literal')) return QUOTED;
      if (text.includes('pg_database')) return { rowCount: 0, rows: [] };
      throw Object.assign(new Error('permission denied'), { code: '42501' });
    });

    await expect(bootstrapAiDatabase(client, config)).rejects.toThrow('permission denied');
  });

  it('rejects unsafe identifiers', async () => {
    const client = fakeClient(() => ({ rowCount: 0, rows: [] }));
    await expect(
      bootstrapAiDatabase(client, { ...config, aiDb: 'evil"; DROP TABLE x;--' }),
    ).rejects.toThrow('invalid AI database name');
  });
});
