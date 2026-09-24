# Terraform — User service (RDS Postgres + RDS Proxy + ElastiCache Redis)

Floci is the primary target; real AWS is a drop-in via endpoint + backend swap. No real-AWS credentials are committed.

```
terraform/
├── versions.tf          # tf + provider pins, local backend (Floci)
├── providers.tf         # aws_region + aws_endpoint_url (Floci vs real)
├── variables.tf         # inputs (VPC, instance classes, etc.)
├── main.tf              # root: user_database + user_cache + SSM/SM
├── outputs.tf           # endpoints + secret ARNs
├── modules/
│   ├── user_database/   # RDS Postgres (2 DBs: users + ai_checkpoints), proxy, master + ai secrets
│   └── user_cache/      # ElastiCache Redis, subnet/SG/param group, auth token
├── envs/
│   └── floci.tfvars     # single-AZ micro (proxy resources created, app uses docker hosts on Floci)
├── backend.hcl.example  # S3 backend for real AWS (provision bucket out-of-band)
└── README.md
```

## Quick start (Floci)

```bash
# Floci must be running at http://localhost:4566 (already)
aws --endpoint-url http://localhost:4566 --region ap-south-1 ssm describe-parameters
aws --endpoint-url http://localhost:4566 --region ap-south-1 secretsmanager list-secrets

# Init + plan (local backend)
terraform -chdir=infrastructure/terraform init
terraform -chdir=infrastructure/terraform plan -var-file=envs/floci.tfvars

# Apply — on Floci this creates mocked RDS/ElastiCache + real SSM/SM entries.
# The proxy resources are created in both envs; on Floci the app secrets
# still point at the docker compose hosts (see main.tf secret_string logic).
terraform -chdir=infrastructure/terraform apply -var-file=envs/floci.tfvars

# Outputs hold the endpoints the app will use via SM/SSM.
terraform -chdir=infrastructure/terraform output
```

## Real AWS (later)

```bash
# 1. Create S3 bucket + DDB table out-of-band (see backend.hcl.example)
# 2. Init with S3 backend
terraform -chdir=infrastructure/terraform init -backend-config=backend.hcl -reconfigure

# 3. Apply with real tfvars (dev/prod to be added)
#    Set aws_endpoint_url = "" and pass real vpc_id/subnet_ids
terraform -chdir=infrastructure/terraform plan  -var-file=envs/prod.tfvars -var="aws_endpoint_url="
terraform -chdir=infrastructure/terraform apply -var-file=envs/prod.tfvars -var="aws_endpoint_url="
```

## After `apply` — seed and run

```bash
# Floci: seed SSM + SM from local env
make -C tools/seed-secrets dry-run
make -C tools/seed-secrets seed-floci   # writes /topos/user/config + topos/user/secrets to Floci

# Run user-service against Floci (see services/user README Independent run)
# compose.yml now carries Floci-friendly defaults, so Floci is just ENV_TYPE=prod
make -C services/user up-floci
# or: ENV_TYPE=prod make -C services/user up
# or: docker compose -f services/user/infra/compose.yml --project-name topos-user-floci up -d --build --wait user-service
```

## Design notes

- **VPC as inputs** — `vpc_id` + `private_subnet_ids` (Floci: `vpc-default-ap-south-1`, `subnet-default-ap-south-1-a/b`). No VPC creation in this stack.
- **RDS Proxy** — one proxy, two databases. The shared instance hosts `topos_users`
  (user service) and `ai_checkpoints` (ai checkpointer); the proxy has an auth
  entry per role and routes by username. Pooled app URLs (`DATABASE_URL`,
  `CHECKPOINT_DB_URL`) use the proxy endpoint with `?sslmode=require`
  (`require_tls=true`); migrate/setup URLs (`DATABASE_URL_MIGRATE`,
  `CHECKPOINT_DB_URL_MIGRATE`) use the direct writer endpoint. On Floci the
  secrets point at the docker compose hosts instead (see `main.tf`
  secret_string logic). Consult `outputs.tf` for which endpoint the app uses.
- **Second database** — RDS only creates the initial DB; after `apply` (real
  AWS), run `modules/user_database/init-ai-db.sql` once against the writer
  endpoint with master creds to create the `ai_checkpointer` role +
  `ai_checkpoints` database (passwords from SM). Docker/local is covered by
  `infrastructure/docker/users-postgres/init/10-ai-checkpoints.sh`.
- **ElastiCache** — provisioned `7.0`, `cache.t4g.micro`, single node on Floci. TLS (`rediss://`) + auth token; the app's `REDIS_URL` handles both `redis://` (dev) and `rediss://` (prod) via ioredis.
- **Secrets** — `aws_ssm_parameter.user_config` (String JSON) + `aws_secretsmanager_secret.user_secrets` (placeholder; real values are ignored on `apply` via `ignore_changes` and populated by `seed-secrets`); same pattern for `ai_config` / `ai_secrets`. The RDS master secret is `topos-user-floci/master` and the AI secret `topos-user-floci/ai-checkpointer` (both TF-managed, add to `TF_MANAGED_SECRETS` guard).
- **State** — local for Floci. S3 backend (`backend.hcl.example`) is for real AWS only; never commit real creds.

## Verify

```bash
# Floci
aws --endpoint-url http://localhost:4566 --region ap-south-1 rds describe-db-instances
aws --endpoint-url http://localhost:4566 --region ap-south-1 elasticache describe-replication-groups
aws --endpoint-url http://localhost:4566 --region ap-south-1 ssm get-parameter --name /topos/user/config
aws --endpoint-url http://localhost:4566 --region ap-south-1 secretsmanager get-secret-value --secret-id topos/user/secrets

# App
curl http://localhost:4001/healthz
curl http://localhost:4001/readyz
curl http://localhost:4001/metrics | grep dependency_up
```
