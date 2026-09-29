-- One-time setup for the second database on the shared RDS instance.
--
-- The RDS instance only creates the initial database (topos_users); run this
-- once against the WRITER endpoint with the master credentials after
-- `terraform apply`, then the ai service connects as the least-privilege
-- ai_checkpointer role (via RDS Proxy in prod, direct writer for setup DDL).
--
--   PGPASSWORD='<master-password-from-SM>' psql \
--     -h <writer-endpoint> -U topos_user -d topos_users \
--     -v ai_password='<ai-password-from-SM>' \
--     -f init-ai-db.sql
--
-- Passwords come from Secrets Manager: ${name_prefix}/master and
-- ${name_prefix}/ai-checkpointer (see module outputs ai_password).
-- Floci/docker do not need this file: init/10-ai-checkpoints.sh in
-- infrastructure/docker/users-postgres covers local volumes.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'ai_checkpointer') THEN
    EXECUTE format(
      'CREATE ROLE %I LOGIN PASSWORD %L',
      'ai_checkpointer',
      :'ai_password'
    );
  ELSE
    EXECUTE format(
      'ALTER ROLE %I WITH LOGIN PASSWORD %L',
      'ai_checkpointer',
      :'ai_password'
    );
  END IF;
END
$$;

SELECT format('CREATE DATABASE %I OWNER %I', 'ai_checkpoints', 'ai_checkpointer')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ai_checkpoints')\gexec

GRANT ALL PRIVILEGES ON DATABASE ai_checkpoints TO ai_checkpointer;
