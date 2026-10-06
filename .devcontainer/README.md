# Dev container

Optional, IDE-agnostic (containers.dev: VS Code, JetBrains Gateway, devpod,
Codespaces). The image holds **toolchains only** — Go 1.25, Python 3.12 +
Poetry, Node 22, protoc, Terraform. Infra (postgres, mongo, redis, kafka,
qdrant) is never baked in; it runs via the existing local compose stack over
the host Docker socket.

## Start

Open the repo in your editor's dev-container flow. First boot runs
`.devcontainer/post-create.sh`: creates `infrastructure/docker/local/.env.local`
from its example, installs deps, generates proto/Prisma stubs. Re-run it
anytime with `bash .devcontainer/post-create.sh`.

## Two ways to run

Targeted (default, fast iteration) — start only the deps you need, run the
service natively. Service hostnames (`user-postgres`, ...) resolve only
inside the compose network, so native runs point at the host gateway with the
published `*_EXT_PORT` values from `infrastructure/docker/local/.env.local`:

```bash
# infra only (example: user stack deps)
docker compose --env-file infrastructure/docker/local/.env.local \
  -f services/user/infra/compose.yml up -d --wait user-postgres user-redis

# native service against it
cd services/user
PORT=4001 ENV_TYPE=dev \
  DATABASE_URL=postgresql://topos_user:topos_pass@host.docker.internal:5432/topos_users \
  DATABASE_URL_MIGRATE=postgresql://topos_user:topos_pass@host.docker.internal:5432/topos_users \
  REDIS_URL=redis://host.docker.internal:6380 \
  npm run dev
```

then e.g. `go run ./cmd/server` in `services/content/`,
`poetry run python -m src.main` in `services/ai/`, `npm run dev` in
`frontend/` (Vite on `:5173`), each with the same host-gateway override
pattern for its store URLs.

Full stack — `make local-up` from the repo root, open
<http://localhost:3000>. Native runs and compose apps cannot share a host
port: use one flow at a time or shift the `*_EXT_PORT` vars in `.env.local`.

## Notes

- Integration tests (testcontainers) work inside the container via the mounted
  host socket; no extra setup.
- Native AI runs need no keys under fake modes:
  `LLM_MODE=fake EMBEDDING_MODE=fake VECTOR_MODE=fake`.
- Prod compose (`make prod-up`) is supported (Terraform + AWS CLI present) but
  never auto-starts: it needs Floci/AWS infra and secret seeding first.
- Regenerate after schema changes: `make generate` in `services/ai` **and**
  `services/content`, `npm run db:generate` in `services/user`,
  `npm run codegen` in `frontend/`.
