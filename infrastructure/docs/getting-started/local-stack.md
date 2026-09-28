# Local infrastructure quick start

From the repository root:

```bash
make local-up
make local-ps
make local-logs
make local-down
```

The root Makefile creates the local environment file when absent and runs
`infrastructure/docker/local/compose.yml`. That Compose file includes the
service-owned Compose definitions, preventing a second copied container
definition from becoming stale.

> [!WARNING]
> `make local-clean` removes volumes. It is an intentional reset, not the
> normal stop command.
