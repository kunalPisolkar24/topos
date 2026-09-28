# Troubleshooting

## Docker cannot start the stack

Check that Docker is running and the Compose plugin is available:

```bash
docker ps
docker compose version
```

Then inspect the resolved stack logs:

```bash
make local-logs
```

## A port is already in use

Stop an older Topos stack with `make local-down`, or find the process already
using the port. The gateway uses `4000`; the frontend uses `3000` in Docker.

## AI calls or search do not work locally

Check the AI and content worker logs. Local fake modes can avoid external model
credentials; real AI or embedding modes need the corresponding environment
settings and dependencies.

## Background work is delayed

A post can be saved before its summary or vector index is complete. Inspect the
content workers and Kafka-related logs rather than assuming the original GraphQL
request failed.

## Configuration is unexpectedly missing

Confirm which environment file the command uses. Local commands use
`infrastructure/docker/local/.env.local`; managed commands use
`infrastructure/docker/prod/.env`. For managed seeding, begin with a
[Seed Secrets dry run](../../tools/seed-secrets/docs/getting-started/quickstart.md).
