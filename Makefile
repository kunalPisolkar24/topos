.PHONY: help local-up local-down local-logs local-ps local-clean prod-up prod-down prod-logs prod-ps prod-clean prod-sync-env prod-nuke check-tfvars infra-plan infra-up infra-output infra-destroy infra-floci-ensure infra-floci-down infra-test-unit infra-test-floci obs-plan obs-apply obs-test-unit obs-test-live obs-test-collector prune

OBS_DIR := infrastructure/observability

LOCAL_DIR := infrastructure/docker/local
LOCAL_ENV := $(LOCAL_DIR)/.env.local
LOCAL_ENV_EXAMPLE := $(LOCAL_DIR)/.env.local.example
COMPOSE_LOCAL := docker compose --env-file $(LOCAL_ENV) -f $(LOCAL_DIR)/compose.yml

PROD_DIR := infrastructure/docker/prod
PROD_ENV := $(PROD_DIR)/.env
PROD_ENV_EXAMPLE := $(PROD_DIR)/.env.example
COMPOSE_PROD := docker compose --env-file $(PROD_ENV) -f $(PROD_DIR)/compose.yml

# Set SEED_SECRETS=1 to upsert .env into Floci/AWS SM+SSM before boot. Default
# skips seeding so terraform-managed real secrets are never clobbered.
SEED_SECRETS ?= 0
SEED_TOOL_DIR := tools/seed-secrets

# Set WITH_INFRA=1 on prod-up to terraform-apply managed infra first (cold boot).
# Default skips it so restarts stay fast. ENV selects the tfvars file.
WITH_INFRA ?= 0
ENV ?= floci
TF_DIR := infrastructure/terraform
TF_VARS := $(TF_DIR)/envs/$(ENV).tfvars
# Destroys are never automatic: prod additionally requires CONFIRM_DESTROY=1.
CONFIRM_DESTROY ?= 0

help:
	@echo "Available commands:"
	@echo ""
	@echo "  Local full stack (single entry point):"
	@echo "  make local-up     - Build and start all local containers"
	@echo "  make local-logs   - Tail logs"
	@echo "  make local-ps     - List containers"
	@echo "  make local-down   - Stop (keeps volumes)"
	@echo "  make local-clean  - Stop and delete volumes"
	@echo ""
	@echo "  Prod stack (Floci/AWS managed infra, no docker DBs):"
	@echo "  make prod-up      - Start prod containers (WITH_INFRA=1 to apply infra first,"
	@echo "                      SEED_SECRETS=1 to seed SM/SSM first)"
	@echo "  make prod-logs    - Tail prod logs"
	@echo "  make prod-ps      - List prod containers"
	@echo "  make prod-down    - Stop prod (keeps volumes)"
	@echo "  make prod-clean   - Stop prod and delete volumes"
	@echo "  make prod-sync-env - Refresh prod .env connection strings from Floci SM"
	@echo "                      (passwords + MSK sidecar; run after infra-up)"
	@echo "  make prod-nuke ENV=floci - Full teardown: prod-clean + infra-destroy"
	@echo "                      + floci emulator/network removal"
	@echo ""
	@echo "  Managed infra (terraform RDS/DocDB/MSK/ElastiCache, ENV=floci|prod):"
	@echo "  make infra-plan   - Plan infra changes"
	@echo "  make infra-up     - Apply infra (Floci: starts emulator + network first)"
	@echo "  make infra-output - Show infra endpoints (fill prod .env from this)"
	@echo "  make infra-destroy - Destroy infra (prod needs CONFIRM_DESTROY=1)"
	@echo "  make infra-floci-down ENV=floci - Stop Floci emulator + remove floci-apps"
	@echo "  make infra-test-unit - Run mocked Terraform contract tests"
	@echo "  make infra-test-floci - Apply and verify live Floci resource contracts"
	@echo ""
	@echo "  Observability (New Relic dashboards, NEW_RELIC_API_KEY env):"
	@echo "  make obs-plan     - Plan dashboards/alerts (NEW_RELIC_ACCOUNT_ID/REGION)"
	@echo "  make obs-apply    - Apply dashboards/alerts"
	@echo "  make obs-test-unit - Run mocked New Relic Terraform contract tests"
	@echo "  make obs-test-live - Read-only New Relic API/dashboard verification"
	@echo "  make obs-test-collector - Validate prod compose and OTEL collector config"
	@echo ""
	@echo "  Utilities:"
	@echo "  make prune    - Prune completely out all unused docker resources"
	@echo ""
	@echo "  Frontend:"
	@echo "  cd frontend && make <target> — see frontend/Makefile (e.g. make dev-preview)"
	@echo "  (from repo root: make -C frontend <target>)"

$(LOCAL_ENV):
	@cp $(LOCAL_ENV_EXAMPLE) $(LOCAL_ENV)
	@echo "Created $(LOCAL_ENV) from example — fill in any required values."

$(PROD_ENV):
	@cp $(PROD_ENV_EXAMPLE) $(PROD_ENV)
	@echo "Created $(PROD_ENV) from example — fill in CHANGEME values from 'terraform output'."

local-up: $(LOCAL_ENV)
	$(COMPOSE_LOCAL) up -d --build --wait

local-down: $(LOCAL_ENV)
	$(COMPOSE_LOCAL) down

local-logs: $(LOCAL_ENV)
	$(COMPOSE_LOCAL) logs -f

local-ps: $(LOCAL_ENV)
	$(COMPOSE_LOCAL) ps

local-clean: $(LOCAL_ENV)
	$(COMPOSE_LOCAL) down -v --remove-orphans

prod-up: $(PROD_ENV)
	@if [ "$(WITH_INFRA)" = "1" ]; then echo "==> [1/3] infra (terraform apply, ENV=$(ENV))"; \
		$(MAKE) --no-print-directory infra-up ENV=$(ENV) || { echo "FAILED phase 1/3: infra — fix the terraform error above, then re-run"; exit 1; }; fi
	@if [ "$(SEED_SECRETS)" = "1" ]; then echo "==> [2/3] seed (SM/SSM from $(PROD_ENV))"; \
		$(MAKE) -C $(SEED_TOOL_DIR) seed-floci ENV_FILE=../../$(PROD_ENV) || { echo "FAILED phase 2/3: seed — check the Floci endpoint / AWS creds"; exit 1; }; fi
	@echo "==> [3/3] app (compose up)"
	@$(COMPOSE_PROD) up -d --build --wait || { echo "FAILED phase 3/3: app — run 'make prod-logs' for details"; exit 1; }
	@echo "prod up: OK"

prod-down: $(PROD_ENV)
	$(COMPOSE_PROD) down

prod-logs: $(PROD_ENV)
	$(COMPOSE_PROD) logs -f

prod-ps: $(PROD_ENV)
	$(COMPOSE_PROD) ps

prod-clean: $(PROD_ENV)
	$(COMPOSE_PROD) down -v --remove-orphans

prod-sync-env: $(PROD_ENV)
	python3 $(PROD_DIR)/sync-env-from-floci.py --env-file $(PROD_ENV) --endpoint-url $${AWS_ENDPOINT_URL:-http://localhost:4566} --region $${AWS_REGION:-ap-south-1}

prod-nuke: check-tfvars
	$(MAKE) --no-print-directory prod-clean
	$(MAKE) --no-print-directory infra-destroy ENV=$(ENV)
	@if [ "$(ENV)" = "floci" ]; then $(MAKE) --no-print-directory infra-floci-down ENV=floci; fi

# --- Managed infra (terraform) ------------------------------------------------
# Floci is the default target (envs/floci.tfvars). Real AWS needs
# infrastructure/terraform/envs/prod.tfvars + backend.hcl (see its README).

check-tfvars:
	@if [ ! -f "$(TF_VARS)" ]; then echo "missing $(TF_VARS) (ENV=$(ENV); try ENV=floci)"; exit 1; fi

infra-floci-ensure:
	@docker network inspect floci-apps >/dev/null 2>&1 || docker network create floci-apps
	@if [ -z "$$(docker ps -q -f name=^floci$$)" ]; then \
		if [ -n "$$(docker ps -aq -f name=^floci$$)" ]; then docker start floci; \
		else docker run -d --name floci -p 4566:4566 -v /var/run/docker.sock:/var/run/docker.sock -u root floci/floci:latest; fi \
	fi
	@for attempt in $$(seq 1 60); do \
		[ "$$(docker inspect -f '{{.State.Health.Status}}' floci 2>/dev/null)" = "healthy" ] && break; \
		[ $$attempt -eq 60 ] && { echo "Floci did not become healthy"; exit 1; }; sleep 2; \
	done
	@docker inspect floci -f '{{range $$k, $$v := .NetworkSettings.Networks}}{{$$k}} {{end}}' 2>/dev/null | grep -qw floci-apps || docker network connect floci-apps floci

infra-plan: check-tfvars
	terraform -chdir=$(TF_DIR) init -input=false
	terraform -chdir=$(TF_DIR) plan -input=false -var-file=envs/$(ENV).tfvars

infra-up: check-tfvars
	@if [ "$(ENV)" = "floci" ]; then $(MAKE) --no-print-directory infra-floci-ensure; fi
	terraform -chdir=$(TF_DIR) init -input=false
	terraform -chdir=$(TF_DIR) apply -input=false -auto-approve -var-file=envs/$(ENV).tfvars

infra-output:
	terraform -chdir=$(TF_DIR) output

infra-floci-down:
	@if [ "$(ENV)" != "floci" ]; then echo "infra-floci-down only supports ENV=floci"; exit 1; fi
	-@docker stop floci 2>/dev/null || true
	-@docker rm floci 2>/dev/null || true
	-@docker network rm floci-apps 2>/dev/null || true

infra-destroy: check-tfvars
	@if [ "$(ENV)" = "prod" ] && [ "$(CONFIRM_DESTROY)" != "1" ]; then echo "refusing to destroy prod without CONFIRM_DESTROY=1"; exit 1; fi
	terraform -chdir=$(TF_DIR) init -input=false
	terraform -chdir=$(TF_DIR) destroy -input=false -auto-approve -var-file=envs/$(ENV).tfvars

infra-test-unit:
	terraform -chdir=$(TF_DIR) init -backend=false -input=false
	terraform -chdir=$(TF_DIR) validate
	terraform -chdir=$(TF_DIR) test -filter=tests/contracts.tftest.hcl

infra-test-floci: check-tfvars
	@if [ "$(ENV)" != "floci" ]; then echo "infra-test-floci only supports ENV=floci"; exit 1; fi
	$(MAKE) --no-print-directory infra-floci-ensure
	terraform -chdir=$(TF_DIR) init -input=false
	@terraform -chdir=$(TF_DIR) apply -input=false -auto-approve -var-file=envs/floci.tfvars || \
	{ echo "first apply hit an emulator flake; retrying once"; \
	terraform -chdir=$(TF_DIR) apply -input=false -auto-approve -var-file=envs/floci.tfvars; }
	AWS_ENDPOINT_URL=http://localhost:4566 AWS_REGION=ap-south-1 bash $(TF_DIR)/tests/verify-floci.sh
	terraform -chdir=$(TF_DIR) plan -input=false -detailed-exitcode -var-file=envs/floci.tfvars

# --- New Relic observability (dashboards + alerts, NEW_RELIC_API_KEY env) ----
obs-plan:
	@test -n "$${NEW_RELIC_API_KEY:-}" || { echo "NEW_RELIC_API_KEY is required"; exit 1; }
	TF_VAR_newrelic_api_key=$$NEW_RELIC_API_KEY terraform -chdir=$(OBS_DIR) init -input=false
	TF_VAR_newrelic_api_key=$$NEW_RELIC_API_KEY terraform -chdir=$(OBS_DIR) plan -input=false -var=newrelic_account_id=$${NEW_RELIC_ACCOUNT_ID:-8557859} -var=newrelic_region=$${NEW_RELIC_REGION:-US}

obs-apply:
	@test -n "$${NEW_RELIC_API_KEY:-}" || { echo "NEW_RELIC_API_KEY is required"; exit 1; }
	TF_VAR_newrelic_api_key=$$NEW_RELIC_API_KEY terraform -chdir=$(OBS_DIR) init -input=false
	TF_VAR_newrelic_api_key=$$NEW_RELIC_API_KEY terraform -chdir=$(OBS_DIR) apply -input=false -auto-approve -var=newrelic_account_id=$${NEW_RELIC_ACCOUNT_ID:-8557859} -var=newrelic_region=$${NEW_RELIC_REGION:-US}

obs-test-unit:
	terraform -chdir=$(OBS_DIR) init -backend=false -input=false
	terraform -chdir=$(OBS_DIR) validate
	terraform -chdir=$(OBS_DIR) test -filter=tests/contracts.tftest.hcl

obs-test-live:
	@test -n "$${NEW_RELIC_API_KEY:-}" || { echo "NEW_RELIC_API_KEY is required"; exit 1; }
	@test -n "$${NEW_RELIC_ACCOUNT_ID:-}" || { echo "NEW_RELIC_ACCOUNT_ID is required"; exit 1; }
	NEW_RELIC_REGION=$${NEW_RELIC_REGION:-US} OBS_ENVIRONMENT=$${OBS_ENVIRONMENT:-prod} python3 $(OBS_DIR)/tests/verify-newrelic.py

obs-test-collector:
	docker compose --env-file $(PROD_ENV_EXAMPLE) -f $(PROD_DIR)/compose.yml config -q
	docker run --rm -e NEW_RELIC_LICENSE_KEY=test -e NEW_RELIC_OTLP_HTTP_ENDPOINT=https://otlp.nr-data.net -v "$(CURDIR)/$(PROD_DIR)/otel-collector-config.yaml:/etc/otelcol/config.yaml:ro" otel/opentelemetry-collector-contrib:0.122.1 validate --config=/etc/otelcol/config.yaml

prune:
	docker system prune -a --volumes -f
