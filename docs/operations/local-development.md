# Local development operations

Use root Makefile commands from the repository root:

```bash
make local-up
make local-ps
make local-logs
make local-down
```

`local-down` retains volumes. This is the normal way to stop work. Use
`local-clean` only for an intentional reset because it includes `docker compose
down -v --remove-orphans`.

The local Compose entry point is
[`infrastructure/docker/local/compose.yml`](../../infrastructure/docker/local/compose.yml).
It includes each service's own Compose definition rather than duplicating their
configuration.
