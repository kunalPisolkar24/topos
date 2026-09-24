#!/bin/sh
# user-migrator entrypoint: ensure the AI checkpoint role/database exist,
# then apply the user-schema migrations. The bootstrap is idempotent and
# never blocks migrations (it warns and continues on failure).
set -eu
node ./scripts/bootstrap-ai-db.mjs
exec npx prisma migrate deploy
