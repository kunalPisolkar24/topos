#!/usr/bin/env node
// user-migrator runner: hydrate SM/SSM when ENV_TYPE=prod (Floci / real
// AWS), ensure the AI checkpoint role/database exist, then apply the
// user-schema migrations.
//
// The AI bootstrap is idempotent and never blocks migrations (warns and
// continues on failure); prisma migrate deploy remains the source of truth
// for the user schema.

import { spawnSync } from 'node:child_process';
import { Client } from 'pg';
import { bootstrapAiDatabase, parseConfig } from './bootstrap-ai-db.mjs';

// Fill-missing SM/SSM hydration, mirroring src/config/env.ts. Pre-existing
// non-empty env wins, so external injection (task def, explicit USER_* env)
// keeps working. Logs key names only, never values.
async function hydrateEnv(env = process.env) {
  if ((env.ENV_TYPE ?? '').trim() !== 'prod') {
    return;
  }
  const region = (env.AWS_REGION ?? '').trim() || 'ap-south-1';
  const endpoint = (env.AWS_ENDPOINT_URL ?? '').trim() || undefined;
  const secretsName = (env.USER_SECRETS_NAME ?? '').trim() || 'topos/user/secrets';
  const configParam = (env.USER_CONFIG_PARAM ?? '').trim() || '/topos/user/config';

  const clientConfig = { region };
  if (endpoint) {
    clientConfig.endpoint = endpoint;
    clientConfig.credentials = {
      accessKeyId: env.AWS_ACCESS_KEY_ID || 'test',
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY || 'test',
    };
  }

  let ssmKeys = 0;
  let smKeys = 0;
  const { SSMClient, GetParameterCommand } = await import('@aws-sdk/client-ssm');
  const { SecretsManagerClient, GetSecretValueCommand } = await import(
    '@aws-sdk/client-secrets-manager'
  );
  const ssm = new SSMClient(clientConfig);
  const sm = new SecretsManagerClient(clientConfig);

  try {
    const res = await ssm.send(new GetParameterCommand({ Name: configParam }));
    if (res.Parameter?.Value) {
      for (const [k, v] of Object.entries(JSON.parse(res.Parameter.Value))) {
        if (v != null && v !== '' && !env[k]) {
          env[k] = String(v);
          ssmKeys += 1;
        }
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes('ParameterNotFound') && !msg.includes('not found')) {
      console.warn(`[migrator] SSM fetch failed for ${configParam}: ${msg}`);
    }
  }

  try {
    const res = await sm.send(new GetSecretValueCommand({ SecretId: secretsName }));
    if (res.SecretString) {
      for (const [k, v] of Object.entries(JSON.parse(res.SecretString))) {
        if (v != null && v !== '' && !env[k]) {
          env[k] = String(v);
          smKeys += 1;
        }
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes('ResourceNotFoundException') && !msg.includes('not found')) {
      console.warn(`[migrator] SM fetch failed for ${secretsName}: ${msg}`);
    }
  }

  const target = endpoint ? `Floci (${endpoint})` : 'real AWS';
  console.log(`[migrator] ENV_TYPE=prod hydrated ${ssmKeys} SSM + ${smKeys} SM keys from ${target}`);
}

await hydrateEnv(process.env);

const config = parseConfig(process.env);
if (!config.skip) {
  const client = new Client({
    connectionString: config.migrateUrl,
    application_name: 'user-migrator-bootstrap',
  });
  try {
    await client.connect();
    await bootstrapAiDatabase(client, config);
    console.log(`[migrator] ensured role "${config.aiUser}" and database "${config.aiDb}"`);
  } catch (err) {
    console.warn(
      `[migrator] AI bootstrap warning: ${err instanceof Error ? err.message : String(err)} (continuing to migrations)`,
    );
  } finally {
    await client.end().catch(() => {});
  }
} else {
  console.log(`[migrator] AI bootstrap skip: ${config.skip}`);
}

const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
