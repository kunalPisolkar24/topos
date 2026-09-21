import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// ---------------------------------------------------------------------------
// ENV_TYPE — toggle between docker (.env) and AWS (SM/SSM)
//   dev  = uses .env from docker (default, zero AWS calls)
//   prod = fetches SM `topos/user/secrets` + SSM `/topos/user/config` via AWS SDK
//          (Floci on http://localhost:4566 or real AWS). Fill-missing semantics:
//          only injects vars that are not already set, so ECS task-def injection
//          and local .env still win.
// ---------------------------------------------------------------------------

const rawEnvType = process.env.ENV_TYPE?.trim() || 'dev';
const isProd = rawEnvType === 'prod';

if (isProd) {
  // Top-level await: hydrate process.env from AWS before zod validates.
  // This keeps a single code path for Floci and real AWS.
  await (async () => {
    const region = process.env.AWS_REGION?.trim() || 'ap-south-1';
    const endpoint = process.env.AWS_ENDPOINT_URL?.trim() || undefined;
    const secretsName = process.env.USER_SECRETS_NAME?.trim() || 'topos/user/secrets';
    const configParam = process.env.USER_CONFIG_PARAM?.trim() || '/topos/user/config';

    const clientConfig: Record<string, unknown> = { region };
    if (endpoint) {
      (clientConfig as Record<string, string>).endpoint = endpoint;
    }
    // Floci uses dummy creds; real AWS uses task role / env creds.
    if (endpoint) {
      (clientConfig as Record<string, unknown>).credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
      };
    }

    try {
      const { SSMClient, GetParameterCommand } = await import('@aws-sdk/client-ssm');
      const { SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');

      const ssm = new SSMClient(clientConfig as never);
      const sm = new SecretsManagerClient(clientConfig as never);

      // Fetch SSM config (JSON String)
      try {
        const ssmRes = await ssm.send(new GetParameterCommand({ Name: configParam }));
        if (ssmRes.Parameter?.Value) {
          const parsed = JSON.parse(ssmRes.Parameter.Value) as Record<string, string>;
          for (const [k, v] of Object.entries(parsed)) {
            if (v != null && v !== '' && !process.env[k]) {
              process.env[k] = String(v);
            }
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes('ParameterNotFound') && !msg.includes('not found')) {
          console.warn(`[env] SSM fetch failed for ${configParam}: ${msg}`);
        }
      }

      // Fetch SM secrets (JSON)
      try {
        const smRes = await sm.send(new GetSecretValueCommand({ SecretId: secretsName }));
        const secretString = smRes.SecretString;
        if (secretString) {
          const parsed = JSON.parse(secretString) as Record<string, string>;
          for (const [k, v] of Object.entries(parsed)) {
            if (v != null && v !== '' && !process.env[k]) {
              process.env[k] = String(v);
            }
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes('ResourceNotFoundException') && !msg.includes('not found')) {
          console.warn(`[env] SM fetch failed for ${secretsName}: ${msg}`);
        }
      }
    } catch (e) {
      console.warn(`[env] AWS SDK load failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  })();
}

// Normalize USER_ prefixed aliases to canonical keys (local .env uses USER_*)
const USER_ALIASES: Record<string, string> = {
  USER_DATABASE_URL: 'DATABASE_URL',
  USER_DATABASE_URL_MIGRATE: 'DATABASE_URL_MIGRATE',
  USER_REDIS_URL: 'REDIS_URL',
  USER_JWT_SECRET: 'JWT_SECRET',
  USER_LOG_LEVEL: 'LOG_LEVEL',
  USER_CACHE_TTL_MS: 'REDIS_CACHE_TTL_MS',
  USER_MISSING_CACHE_TTL_MS: 'REDIS_MISSING_CACHE_TTL_MS',
};
for (const [aliased, canonical] of Object.entries(USER_ALIASES)) {
  if (process.env[aliased] && !process.env[canonical]) {
    process.env[canonical] = process.env[aliased];
  }
}

const envSchema = z.object({
  ENV_TYPE: z.enum(['dev', 'prod']).default('dev'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4001),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z
    .preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),
  OTEL_SERVICE_NAME: z.string().default('user-service'),
  DATABASE_URL: z.string().url(),
  DATABASE_URL_MIGRATE: z.string().url().optional(),
  JWT_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().default('user-service'),
  JWT_AUDIENCE: z.string().default('topos'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  REDIS_URL: z
    .preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),
  REDIS_CACHE_TTL_MS: z.coerce.number().int().positive().default(3600000),
  REDIS_MISSING_CACHE_TTL_MS: z.coerce.number().int().positive().default(60000),
  AWS_REGION: z.string().default('ap-south-1'),
  AWS_ENDPOINT_URL: z
    .preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),
  USER_SECRETS_NAME: z.string().default('topos/user/secrets'),
  USER_CONFIG_PARAM: z.string().default('/topos/user/config'),
});

export const env = envSchema.parse(process.env);
