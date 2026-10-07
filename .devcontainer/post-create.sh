#!/usr/bin/env bash
# First-boot setup for the Topos dev container. Idempotent and re-runnable:
#   bash .devcontainer/post-create.sh
#
# Two phases: system installs stay root-friendly, then workspace steps re-run
# as the checkout owner so generated files and node_modules are not
# root-owned on the mounted workspace.
set -euo pipefail

# Feature tool locations are absent from PATH when this runs as root with a
# minimal environment (postCreateCommand), so pin them up front.
export PATH="/usr/local/python/current/bin:/usr/local/py-utils/bin:/usr/local/share/nvm/current/bin:/usr/local/go/bin:/go/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_ENV="$ROOT/infrastructure/docker/local/.env.local"

log() { printf '==> %s\n' "$*"; }

# First interpreter on PATH that actually has pip. Bare `python3` may be the
# system one without pip when PATH is minimal.
find_python_with_pip() {
  local cand
  for cand in /usr/local/python/current/bin/python3 /usr/local/bin/python3 "$(command -v python3 || true)"; do
    if [ -n "$cand" ] && [ -x "$cand" ] && "$cand" -m pip --version >/dev/null 2>&1; then
      printf '%s' "$cand"
      return 0
    fi
  done
  return 1
}

# Poetry, matching CI (.github/workflows/service-ai.yaml: pip install poetry).
ensure_poetry() {
  command -v poetry >/dev/null 2>&1 && return 0
  log "installing poetry"
  local py
  if py="$(find_python_with_pip)"; then
    if [ "$(id -u)" -eq 0 ]; then
      "$py" -m pip install --no-cache-dir poetry
    elif command -v sudo >/dev/null 2>&1; then
      sudo "$py" -m pip install --no-cache-dir poetry
    else
      "$py" -m pip install --no-cache-dir --user poetry
    fi
  elif command -v pipx >/dev/null 2>&1; then
    pipx install poetry
  else
    curl -sSL https://install.python-poetry.org | python3 -
  fi
}

drop_privileges_if_root() {
  [ "$(id -u)" -ne 0 ] && return 0
  local owner
  owner="$(stat -c '%U' "$ROOT")"
  if [ "$owner" != "root" ] && [ "$owner" != "UNKNOWN" ] && id "$owner" >/dev/null 2>&1; then
    log "re-running workspace steps as $owner"
    exec su "$owner" -c "bash '$ROOT/.devcontainer/post-create.sh' --workspace-steps"
  fi
}

workspace_steps() {
  export PATH="$HOME/go/bin:$HOME/.local/bin:$PATH"
  if ! grep -qxF 'export PATH="$HOME/go/bin:$PATH"' "$HOME/.bashrc" 2>/dev/null; then
    printf '%s\n' 'export PATH="$HOME/go/bin:$PATH"' >> "$HOME/.bashrc"
  fi
  if ! grep -qxF 'export PATH="$HOME/.local/bin:$PATH"' "$HOME/.bashrc" 2>/dev/null; then
    printf '%s\n' 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
  fi

  # Local compose env, mirroring the $(LOCAL_ENV) target in the root Makefile.
  if [ ! -f "$LOCAL_ENV" ]; then
    log "creating infrastructure/docker/local/.env.local from example"
    cp "$ROOT/infrastructure/docker/local/.env.local.example" "$LOCAL_ENV"
  else
    log ".env.local already exists, leaving it alone"
  fi

  # Go plugin binaries for `make generate` after proto edits (versions pinned
  # in services/content/Makefile). The stubs themselves are tracked in git,
  # so post-create only warms the module cache and never dirties the tree.
  command -v protoc-gen-go >/dev/null 2>&1 || go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.11
  command -v protoc-gen-go-grpc >/dev/null 2>&1 || go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.6.0

  log "installing ai deps + generating proto stubs"
  (cd "$ROOT/services/ai" && poetry install --no-interaction && make generate)

  log "downloading content modules"
  (cd "$ROOT/services/content" && go mod download)

  # Dummy URL mirrors the prisma step in services/user/Dockerfile.
  log "installing user deps + generating prisma client"
  (cd "$ROOT/services/user" && npm ci --no-audit --no-fund && DATABASE_URL_MIGRATE="postgresql://dummy:dummy@localhost:5432/dummy" npm run db:generate)

  log "installing frontend deps"
  (cd "$ROOT/frontend" && npm ci --no-audit --no-fund)

  log "dev container setup complete"
}

case "${1:-}" in
  --workspace-steps) workspace_steps ;;
  *)
    ensure_poetry
    drop_privileges_if_root
    workspace_steps
    ;;
esac
