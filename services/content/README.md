# Content Service

GraphQL API for posts and tags (`content-service`) with async workers
consuming post events from Kafka: `content-worker` (AI summaries),
`content-search-worker` (vector indexing) and `content-personalizer`.
Go, gqlgen, MongoDB, Redis, Kafka.

## Layout

- `cmd/` — service, worker, search worker, personalizer and `dlq-replay` entrypoints
- `internal/` — config, cache, service, worker, dlq, middleware, metrics
- `graph/` — GraphQL schema and resolvers
- `infra/` — compose files (`compose.yml` dev, `compose.load.yml` load tests)
- `load-tests/` — k6 scripts and producer

## Local dev

```sh
cp .env.example .env
docker compose -f infra/compose.yml up -d --build
```

- API: `http://localhost:4002` (GraphQL at `/query`, health at `/health`)
- Worker metrics: `http://localhost:4003/metrics`
- Search worker metrics: `http://localhost:4004/metrics`
- Personalizer metrics: `http://localhost:4005/metrics`
- Shared infra (standalone):
  - MongoDB standalone (`content-mongo:27017`, `infrastructure/docker/content-mongo/mongo.yml`)
  - Kafka single broker KRaft (`kafka-1:9092`, `infrastructure/docker/content-kafka/kafka.yml`)
  - Redis via `user-redis:6379` (`infrastructure/docker/users-redis/redis.yml`)
- `init-kafka` creates `posts`, `posts-dlq` and `user-interacted` topics (RF 1).

Tear down with `docker compose -f infra/compose.yml down -v`.

## Future managed services

- MongoDB → DocumentDB
- Kafka → AWS MSK
- Redis → ElastiCache (standalone `user-redis` today)

## MongoDB index design

- Standalone MongoDB with unique `slug` index (`slug_unique`). Slug uniqueness
  is also enforced in-app by `PostService.ensureSlugAvailable` with retry.

## Resilience

Workers retry failed messages up to 5 times with a 5s · attempt backoff,
then publish them to `KAFKA_DLQ_TOPIC` (`posts-dlq`) as
`DeadLetterMessage` envelopes. `cmd/dlq-replay` republishes dead letters
onto their original topic, resuming from committed offsets, so a second
run only replays what is still in the DLQ:

```sh
# runs inside the compose network (kafka-1:9092 is not reachable from the host)
docker run --network topos_local_network --env-file ../../infrastructure/docker/local/.env.local \
  content-content-worker ./content-dlq-replay
```

### Worker health

Both workers expose `/health` (HTTP 200 only when mongo, kafka, the
consume loops **and** the AI service are healthy). The AI check is
free of RPCs: it fails when any circuit breaker is open or the gRPC
connection is not ready, so a worker that is alive but dead-lettering
everything no longer reports ready. The search worker emits the same
OTel spans as the summary worker (`index post`, `delete from index`
with post id, partition and offset).

### Mongo startup retry

`db.Connect` fails fast on a malformed URI, but a transient ping failure
is retried with exponential backoff (1s, 2s, 4s, 8s, 16s, ~31s budget,
respecting shutdown cancellation), so a single boot-time blip does not
kill the process outside compose gating.

### Redis cache

The Redis cache is read-through and degrades gracefully: on any Redis
failure reads fall through to Mongo and writes always go to Mongo. To
make degradation observable instead of invisible, every swallowed Redis
error is logged at warn level and counted in
`content_cache_errors_total`; hits and misses are counted in
`content_cache_hits_total` / `content_cache_misses_total`.

Client timeouts and retries are explicit:

- `DialTimeout` 2s, `ReadTimeout`/`WriteTimeout` 3s
- 3 retries with 50ms–500ms backoff

Concurrent misses for the same key are coalesced (single-flight): a
burst of requests right after expiry or invalidation shares one fill
instead of stampeding Mongo or the AI service.

## Checks

```sh
make test               # unit tests (fast)
make test-integration   # integration tests (testcontainers: mongo, kafka,
                        # redis) — covers worker retries, poison -> DLQ and
                        # the replay round trip against real Kafka
make vet
make fmt
```

Load tests: see `load-tests/README.md` (`make load-test`, `make load-test-worker`, ...).
