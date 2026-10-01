# Deployment

How the gateway image is built, tagged, shipped, and wired into each stack —
plus the rebuild rule that catches people out after every schema change.

## New to this service?

Read [Architecture](../concepts/architecture.md) first if you have not seen the
two-stage Dockerfile. This page is about moving the image, not designing it.

## The one rule

**A schema change is a gateway rebuild.** The supergraph is composed inside
the image:

```dockerfile
COPY ./services/user/schema.graphql           ./subgraphs/user.graphql
COPY ./services/content/graph/schema.graphqls ./subgraphs/content.graphql
COPY ./gateway/supergraph.yaml                ./supergraph.yaml
RUN rover supergraph compose --config ./supergraph.yaml > supergraph.graphql
```

`docker compose restart gateway` re-reads nothing — it has no volume mounts and
no host-side config. The steps after editing any subgraph schema are:

```bash
make local-up          # --build rebuilds the gateway image
# or, gateway only:
docker compose -f infrastructure/docker/local/compose.yml build gateway
docker compose -f infrastructure/docker/local/compose.yml up -d gateway
```

Skip it and you get `PARSING_ERROR: no field ...` for every new field — the
router is planning against the previous schema.

## Building the image

```bash
docker build -f gateway/Dockerfile -t topos-gateway .
```

Context is the **repository root**, not `gateway/`, because stage 1 has to read
both subgraph schemas. Verified locally: the build composes a 311-line
supergraph and exits `0`.

| Stage | Base | Work |
| --- | --- | --- |
| `composer` | `debian:bookworm-slim` | Install curl, ca-certificates, Rover; accept ELv2; run `rover supergraph compose` |
| final | `ghcr.io/apollographql/router:v1.38.0` | Copy `router.yaml` and the composed schema into `/dist/` |

The only failure points in that chain are Rover downloading the pinned
`supergraph` plugin (`v2.10.3`) and composition itself. Both are exercised by
CI on every schema change.

## Version pinning

| What | Pin | Where |
| --- | --- | --- |
| Router binary | `ghcr.io/apollographql/router:v1.38.0` (exact tag) | `Dockerfile` |
| Federation version | `=2.10.3` (exact, note the `=`) | `supergraph.yaml` |
| Composition tool | `rover .../nix/latest` (installs latest Rover) | `Dockerfile`, CI |

Two different philosophies in one build: the router and the federation version
are frozen, Rover floats. That is safe because Rover's job here is only to
produce the schema, and the pinned `federation_version` forces it to download a
matching plugin regardless of Rover's own version. The build log shows this
explicitly:

```text
downloading the 'supergraph' plugin from https://rover.apollo.dev/tar/supergraph/x86_64-unknown-linux-gnu/v2.10.3
```

Upgrading the router means changing one line in the Dockerfile and rebuilding.
Upgrading federation means changing `federation_version` **and** rebuilding both
subgraph services if they emit directives the new spec interprets differently.

## The three Compose files

| File | Consumed by | Defaults? | Notes |
| --- | --- | --- | --- |
| `gateway/compose.local.yml` | `infrastructure/docker/local/compose.yml` via `include` | yes (`local-gateway`, `4000:4000`, `topos_local_network`) | The local stack |
| `infrastructure/docker/prod/compose.yml` (inline `gateway:` block) | `make prod-up` | yes (`prod-gateway`, `4000:4000`) | Adds three environment variables and a third dependency |
| `gateway/compose.yml` | nothing | **no** | All four variables are mandatory |

### Local

```bash
make local-up      # up -d --build --wait
make local-ps
make local-logs
make local-down
```

Network is a named bridge (`topos_local_network` by default), which is what
gives the containers the `user-service` and `content-service` names that
`supergraph.yaml` uses.

### Production

```bash
make prod-up       # optional phases: WITH_INFRA=1, SEED_SECRETS=1
make prod-ps
make prod-logs
make prod-down
```

Differences from local:

```yaml
environment:
  - FRONTEND_PUBLIC_ORIGIN=${FRONTEND_PUBLIC_ORIGIN:-${VITE_BACKEND_URL:-}}
  - OTEL_TRACING_ENDPOINT=${OTEL_TRACING_ENDPOINT:-http://otel-collector:4317}
  - OTEL_SERVICE_NAME=gateway
depends_on:
  - user-service
  - content-service
  - otel-collector
networks:
  - floci-bridge
```

| Variable | Effect |
| --- | --- |
| `FRONTEND_PUBLIC_ORIGIN` | Becomes the fourth allowed CORS origin via `${env...:-}` in `router.yaml` |
| `OTEL_TRACING_ENDPOINT` | Overrides the default `http://otel-collector:4317` |
| `OTEL_SERVICE_NAME` | Names traces `gateway` instead of `unknown_service:router` |

None of these require a rebuild — they are read at process start.

The extra `depends_on: otel-collector` only guarantees **startup order**. There
is no `condition: service_healthy`, and no healthcheck is defined for either
the gateway or the collector.

### Ports across environments

| Environment | Host port | Container port | Set by |
| --- | --- | --- | --- |
| Local | `4000` | `4000` | `GATEWAY_EXT_PORT:-4000`, `GATEWAY_INT_PORT:-4000` |
| Production | `4000` | `4000` | same variables, from the prod `.env` |
| Either | — | `8088` | never published |

Changing `GATEWAY_EXT_PORT` moves only the host side; the container still
listens on whatever `supergraph.listen` says. If you change
`supergraph.listen`, set `GATEWAY_INT_PORT` to match or the mapping points at a
closed port.

## CI and image publishing

`.github/workflows/service-gateway.yaml` runs two jobs.

### Job 1: `quality-assurance`, verifying supergraph composition

Runs on every pull request, and on pushes to `main` or `staging`, when any of
these change:

| Path | Why |
| --- | --- |
| `gateway/**` | Config, Dockerfile, docs |
| `services/user/schema.graphql` | A subgraph schema |
| `services/content/graph/schema.graphqls` | The other subgraph schema |
| `.github/workflows/service-gateway.yaml` | The check itself |

The job is a faithful rehearsal of the Dockerfile's build step:

```bash
mkdir -p subgraphs
cp services/user/schema.graphql          subgraphs/user.graphql
cp services/content/graph/schema.graphqls subgraphs/content.graphql
cp gateway/supergraph.yaml                supergraph.yaml
rover supergraph compose --config ./supergraph.yaml > /tmp/supergraph.graphql
test -s /tmp/supergraph.graphql
```

`test -s` means "exists and is not empty" — composition either produced a
schema or the step fails. **This is the gateway's entire test suite.** There
are no unit or integration tests, because there is no code. See
[Testing overview](../testing/overview.md).

### Job 2: `build-and-push`, publishing the image

Runs only on `push` to `main`/`staging` or manual dispatch, never on pull
requests, and only after job 1 passes.

| Setting | Value |
| --- | --- |
| Image | `kunalpisolkar/topos-gateway` |
| Tags | branch name, `latest` (only from `main`), and the commit SHA |
| Context / file | `.` / `./gateway/Dockerfile` |
| Cache | registry-backed at `kunalpisolkar/topos-gateway:buildcache` |

`cancel-in-progress: true` on the workflow means a newer push to the same
branch abandons an in-flight build.

Note the path filter: a change to `frontend/**` or `docs/**` does **not** build
a gateway image, and a change to a subgraph schema does **not** trigger that
subgraph's own workflow unless its paths match too — but it does trigger this
one, because composition is the gateway's concern.

## Rebuild checklist

After changing anything that affects the schema:

1. **Compose locally first** — `rover supergraph compose` beats waiting for CI.
   See [Testing overview](../testing/overview.md).
2. **Rebuild the gateway image.** `make local-up` does this for you.
3. **Restart the subgraphs too** if you changed their schemas — the gateway's
   supergraph must match what they actually serve at runtime.
4. **Smoke-test a query that crosses an entity**, not just `{ __typename }`:

   ```bash
   curl -s http://localhost:4000/graphql \
     -H 'content-type: application/json' \
     -d '{"query":"{ posts(page:1, limit:1) { posts { id author { username } } } }"}'
   ```

5. **Check health on 8088** — `docker run --rm --network
   container:local-gateway curlimages/curl:latest -fsS
   http://localhost:8088/health`.

The `{ __typename }` check in step 4's counterpart is deliberately not enough:
it passes even with a completely stale supergraph, because the router resolves
it without contacting a subgraph.

## Failure modes during rollout

| Symptom after deploy | Cause |
| --- | --- |
| `PARSING_ERROR` on a new field | Image not rebuilt after the schema change |
| `SUBREQUEST_HTTP_ERROR` with `dns error` naming a service | Network alias does not match `supergraph.yaml` `routing_url`, or the subgraph never started |
| Gateway exits immediately with a config error | `router.yaml` is invalid YAML or an unknown key |
| Composition fails during build | The two subgraph schemas disagree — a renamed type or field on one side only |
| CORS rejects the deployed frontend | `FRONTEND_PUBLIC_ORIGIN` not set in the prod environment |
| `OpenTelemetry trace error` repeating in prod logs | `OTEL_TRACING_ENDPOINT` wrong, or `otel-collector` unreachable on `floci-bridge` |
| Port refused on the host | `GATEWAY_EXT_PORT` changed in `.env` but clients still use 4000 |

The third and fourth rows both fail **loudly and early**, which is the main
benefit of composing at build time rather than at boot.

## See also

| Topic | Page |
| --- | --- |
| What the image contains | [Architecture](../concepts/architecture.md) |
| Every configuration key | [Configuration](../getting-started/configuration.md) |
| Health, metrics, traces after deploy | [Health and observability](health-and-observability.md) |
| Validating a change before CI does | [Testing overview](../testing/overview.md) |
