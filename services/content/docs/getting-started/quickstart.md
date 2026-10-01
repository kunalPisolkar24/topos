# Quick start

Get the Content service running, prove it works with a real query, then
turn on the background workers.

Run every command from **`services/content/`** unless stated otherwise.

## Prerequisites

| Need | Why | Check |
| --- | --- | --- |
| Docker + Docker Compose v2 | MongoDB, Kafka, Redis, and the service itself run in containers | `docker compose version` |
| Go 1.25+ | Only if you run binaries on the host or the tests | `go version` |
| `make` | Every command below is a Make target | `make --version` |
| `curl` | Verification steps | `curl --version` |

No local MongoDB, Kafka, or Redis install is required.

## Start the API

```bash
make up
```

That builds the image and starts the containers below with `--wait`, so
the command only returns once every health check passes (the Compose
health check is `GET /healthz`):

| Container | Role | Host port |
| --- | --- | --- |
| `content-service` | GraphQL API | **4002** |
| `content-mongo` | MongoDB | 27017 |
| `user-redis` | Redis (shared with the user service) | 6379 |
| `kafka` + `init-kafka` | Kafka broker + one-shot topic creation | 9092 |

`init-kafka` runs once and exits; it is not a long-running service.

> **Only the API publishes a host port.** The workers bind their ports
> inside the Docker network only — see
> [Endpoints](#endpoints).

## Verify it is alive

```bash
curl -s localhost:4002/healthz      # {"status":"ok"}
curl -s localhost:4002/readyz       # {"status":"ok","db":"ok"}
```

| Response | Meaning |
| --- | --- |
| `healthz` 200 `ok` | The process is up |
| `healthz` 503 `shutting_down` | Draining after a signal |
| `readyz` 200 `ok` | MongoDB pinged successfully |
| `readyz` 503 `degraded` | MongoDB unreachable — the API is running but cannot serve data |

`/readyz` checks **only MongoDB and the shutting-down flag**. It does not
check Redis, Kafka, or the AI service, all of which are optional.

## Run a public query

Open <http://localhost:4002/> for the GraphQL playground, or use curl:

```bash
curl -s http://localhost:4002/query \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ posts(limit: 3) { totalPosts currentPage posts { id title slug } } }"}'
```

On a fresh stack the result is an empty page — that is success:

```json
{"data":{"posts":{"totalPosts":0,"currentPage":1,"posts":[]}}}
```

Five queries need no token at all: `posts`, `post`, `tags`, `postsByTag`,
and `searchPosts`.

## Create a token

Every mutation needs a Bearer token. The service verifies HS256 JWTs
with three required claims: `id` (a **string**), `iss` (default
`user-service`), and `aud` (default `topos`).

For local work you can mint one yourself with the compose default secret
`local-dev-secret`:

```bash
b64url() { openssl base64 -e -A | tr '+/' '-_' | tr -d '='; }
H='{"alg":"HS256","typ":"JWT"}'
P="{\"id\":\"demo-user-1\",\"iss\":\"user-service\",\"aud\":\"topos\",\"exp\":$(( $(date +%s) + 86400 ))}"
HEAD=$(printf '%s' "$H" | b64url)
BODY=$(printf '%s' "$P" | b64url)
SIG=$(printf '%s.%s' "$HEAD" "$BODY" \
      | openssl dgst -sha256 -hmac "local-dev-secret" -binary | b64url)
TOKEN="$HEAD.$BODY.$SIG"
echo "$TOKEN"
```

> In a real environment you get this token from the user service's
> `login` mutation instead. Both services must share `JWT_SECRET`,
> `JWT_ISSUER`, and `JWT_AUDIENCE` — see
> [Authentication](../concepts/authentication.md).

## Run your first mutation

```bash
curl -s http://localhost:4002/query \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "query": "mutation($in: CreatePostInput!) { createPost(input: $in) { id title slug summaryStatus } }",
    "variables": { "in": {
      "title": "Hello Topos",
      "body": "<p>My first post, written through the quick start.</p>",
      "tags": ["go", "graphql"]
    }}
  }'
```

Expected:

```json
{"data":{"createPost":{"id":"...","title":"Hello Topos","slug":"hello-topos-...","summaryStatus":"PENDING"}}}
```

`summaryStatus: PENDING` means the post exists and background enrichment
has been queued. See [Publishing flow](../concepts/publishing-flow.md).

Try it again with **no** `Authorization` header:

```json
{"errors":[{"message":"unauthorized","path":["createPost"]}]}
```

That is the GraphQL shape. Send an *invalid* token instead and you get a
plain-text HTTP 401 — a different response entirely. See
[Error handling](../components/error-handling.md).

## Turn on the workers

The API alone does not summarize, index, or personalize. Start them:

```bash
make up-all     # API + summary worker + search worker + personalizer
```

or individually:

```bash
make up-worker          # content-worker     → generates summaries
make up-search          # content-search-worker → indexes for search
make up-personalizer    # content-personalizer  → updates profiles
```

Now watch the post you created get enriched:

```bash
make logs SERVICE=content-worker | grep -i summary

curl -s http://localhost:4002/query -H 'Content-Type: application/json' \
  -d '{"query":"{ posts(limit:1) { posts { id title summaryStatus summary } } }"}'
```

`summaryStatus` moving from `PENDING` to `COMPLETED` proves the whole
pipeline works. If it stays `PENDING`, read
[Reliability](../operations/reliability.md).

> Workers need no AI service to consume — but with no AI service the
> summary fails five times and lands in the DLQ. Add the AI service via
> the root stack for real summaries.

## Endpoints

| Endpoint | Published on host? | Purpose |
| --- | --- | --- |
| `http://localhost:4002/query` | **yes** | GraphQL operations |
| `http://localhost:4002/` | **yes** | GraphQL playground |
| `http://localhost:4002/healthz` | **yes** | Liveness |
| `http://localhost:4002/readyz` | **yes** | Readiness (MongoDB) |
| `http://localhost:4002/metrics` | **yes** | Prometheus metrics |
| `http://localhost:4002/internal/posts/{id}` | **yes** (needs `X-Internal-Secret`) | AI-service callback |
| `:4003` summary worker | no — Docker network only | `/healthz`, `/readyz`, `/metrics` |
| `:4004` search worker | no — Docker network only | `/healthz`, `/readyz`, `/metrics` |
| `:4005` personalizer | no — Docker network only | `/healthz`, `/readyz`, `/metrics` |

There is **no `/health` route** — the paths are `/healthz` and `/readyz`.

To reach a worker's metrics from the host:

```bash
docker compose -p topos-content-local exec content-worker \
  curl -s localhost:4003/readyz
```

## Choose which processes to run

| Command | Starts |
| --- | --- |
| `make up` (same as `up-service`) | API + MongoDB + Redis + Kafka |
| `make up-worker` | Summary worker (+ its dependencies) |
| `make up-search` | Search worker (+ Kafka) |
| `make up-personalizer` | Personalizer (+ Kafka) |
| `make up-all` | Everything in one project |
| `make down` | Stop, keep volumes |
| `make clean` | Stop **and delete** MongoDB/Redis/Kafka volumes |
| `make ps` | List running containers |
| `make logs [SERVICE=name]` | Tail logs |
| `make up-prod` / `make down-prod` | The prod compose file |

> `make clean` deletes your data. `make down` does not.

## Run without Docker

```bash
cd services/content
cp .env.example .env          # then edit MONGO_URI, REDIS_ADDR, KAFKA_BROKERS
go run ./cmd/server           # PORT defaults to 4002
```

`.env` is read once at startup by `godotenv`. **`JWT_SECRET` and
`INTERNAL_TOKEN` are mandatory** — the process exits immediately without
them:

```
JWT_SECRET is required
```

Workers use the same `.env`; set `PORT` explicitly because they default
to 4002 too:

```bash
PORT=4003 go run ./cmd/worker
```

## Try the degraded modes

Each dependency can be switched off to prove the service degrades
correctly:

```bash
make up WITH_REDIS=0     # cache disabled — reads still work, just slower
make up WITH_KAFKA=0     # mutations succeed, events are lost
make up WITH_MONGO=0     # boots, but /readyz returns 503
make up-service WITH_REDIS=0 WITH_KAFKA=0   # combine flags
```

```bash
curl -s localhost:4002/readyz
# WITH_MONGO=0 → {"status":"degraded","db":"unavailable"}  (HTTP 503)
```

Verify the API still answers with no cache:

```bash
curl -s http://localhost:4002/query -H 'Content-Type: application/json' \
  -d '{"query":"{ posts(limit:1) { totalPosts } }"}'
```

## Use the full stack instead

`make up` runs the content service in isolation. For the whole product —
frontend, gateway, user service, AI service — use the repo root:

```bash
# from the repository root
make local-up       # everything
make local-logs
make local-down
```

The gateway at <http://localhost:4000/graphql> merges this subgraph with
the user subgraph, which is what the frontend talks to. Authored posts
then get real AI summaries, because the AI service is present.

Copy `infrastructure/docker/local/.env.local.example` to `.env.local`
first, and keep `USER_JWT_SECRET` and `CONTENT_JWT_SECRET` equal.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `JWT_SECRET is required` | `.env` missing or empty — `cp .env.example .env` |
| `readyz` 503 `degraded` | MongoDB not up yet, or `WITH_MONGO=0`. Check `make ps` |
| `Connection refused` on 4002 | Stack not started, or still building — `make ps` |
| Port 4002 already allocated | Another project owns it: `CONTENT_SERVICE_EXT_PORT=4102 make up` |
| `unauthorized` on a mutation | No token — see [Create a token](#create-a-token) |
| HTTP 401 plain text | Token present but invalid — wrong secret, expired, or non-string `id` |
| `summaryStatus` stuck on `PENDING` | Worker not running (`make up-worker`) or AI down — see [Reliability](../operations/reliability.md) |
| Empty search results | Search worker not running, or nothing indexed yet |
| `no matches found: --include=...` | You are in the wrong directory — `cd services/content` |
| `make lint` fails | **There is no `lint` target.** Use `make vet` and `make fmt` |

## Next steps

- [Configuration](configuration.md) — every setting and its default
- [Architecture](../concepts/architecture.md) — how the code is layered
- [Publishing flow](../concepts/publishing-flow.md) — what happens after `createPost`
- [GraphQL API](../components/graphql-api.md) — the full API surface
