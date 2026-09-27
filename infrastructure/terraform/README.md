# Terraform — Topos managed infrastructure

Floci is the primary target; real AWS is a drop-in via endpoint + backend swap. No real-AWS credentials are committed.

```
terraform/
├── versions.tf          # tf + provider pins, local backend (Floci)
├── providers.tf         # aws_region + aws_endpoint_url (Floci vs real)
├── variables.tf         # inputs (VPC, instance classes, etc.)
├── main.tf              # composition root: user/content infrastructure modules
├── config.tf            # SSM non-secret service configuration
├── secrets.tf           # Secrets Manager service connection configuration
├── outputs.tf           # endpoints + secret ARNs
├── modules/
│   ├── user_database/    # RDS Postgres (2 DBs: users + ai_checkpoints), proxy, master + AI secrets
│   ├── user_cache/       # ElastiCache Redis, subnet/SG/param group, auth token
│   ├── content_database/ # DocumentDB cluster and master secret
│   ├── content_streaming/ # MSK cluster and security group
│   └── security_group/   # reusable least-privilege ingress/egress definition
├── tests/               # mocked Terraform and live Floci contract tests
├── envs/
│   └── floci.tfvars     # single-AZ micro (proxy resources created, app uses docker hosts on Floci)
├── backend.hcl.example  # S3 backend for real AWS (provision bucket out-of-band)
└── README.md
```

## Quick start (Floci)

Real Floci (`floci/floci`, Docker-backed RDS/ElastiCache — not LocalStack):

```bash
# 1. Start Floci (needs the Docker socket; name must stay `floci`)
docker run -d --name floci -p 4566:4566 \
  -v /var/run/docker.sock:/var/run/docker.sock -u root \
  floci/floci:latest
# 2. Attach it to the app network used by compose.prod.yml stacks
docker network create floci-apps
docker network connect floci-apps floci

aws --endpoint-url http://localhost:4566 --region ap-south-1 ssm describe-parameters
aws --endpoint-url http://localhost:4566 --region ap-south-1 secretsmanager list-secrets

# Init + plan (local backend)
terraform -chdir=infrastructure/terraform init
terraform -chdir=infrastructure/terraform plan -var-file=envs/floci.tfvars

# Apply — on Floci this creates Docker-backed RDS/ElastiCache (real wire
# protocols) + SSM/SM entries. The app secrets point at the Floci
# container (`floci:7001` / `floci:6379`, see main.tf secret_string logic).
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

# Run user-service against Floci (see services/user README)
make -C services/user up-prod
# or: docker compose -f services/user/infra/compose.prod.yml --project-name topos-user-prod up -d --build --wait user-service
```

## Design notes

- **VPC as inputs** — `vpc_id` + `private_subnet_ids` (Floci: `vpc-default-ap-south-1`, `subnet-default-ap-south-1-a/b`). No VPC creation in this stack.
- **RDS Proxy** — one proxy, two databases. The shared instance hosts `topos_users`
  (user service) and `ai_checkpoints` (ai checkpointer); the proxy has an auth
  entry per role and routes by username. On real AWS, pooled app URLs
  (`DATABASE_URL`, `CHECKPOINT_DB_URL`) use the proxy endpoint with
  `?sslmode=require` (`require_tls=true`); migrate/setup URLs
  (`DATABASE_URL_MIGRATE`, `CHECKPOINT_DB_URL_MIGRATE`) use the direct
  writer endpoint. On Floci both app and migrate URLs point direct at the
  Floci container (`floci:7001`, see `main.tf` secret_string logic).
  Consult `outputs.tf` for which endpoint the app uses.
- **Second database** — RDS only creates the initial DB; after `apply` (real
  AWS), run `modules/user_database/init-ai-db.sql` once against the writer
  endpoint with master creds to create the `ai_checkpointer` role +
  `ai_checkpoints` database (passwords from SM). Docker/local is covered by
  `infrastructure/docker/users-postgres/init/10-ai-checkpoints.sh`.
- **ElastiCache** — provisioned `7.0`, `cache.t4g.micro`, single node on Floci. Auth token; on Floci the app uses plaintext `redis://` with the token against the Floci proxy (`floci:6379`), on real AWS `rediss://`. The client speaks RESP2 (`protocol: 2` in `src/lib/redis.ts`) since Floci's proxy closes `HELLO 3` handshakes.
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

## Test

```bash
# Fast, mocked provider tests. Does not need Docker or Floci.
make infra-test-unit

# Starts Floci if necessary, applies the stack, validates AWS-compatible
# resource/configuration contracts, then requires an idempotent plan.
make infra-test-floci
```

`infra-test-floci` is intentionally restricted to `ENV=floci`; it never
targets real AWS. The CI workflow runs both test layers and destroys its
ephemeral Floci resources afterward.
