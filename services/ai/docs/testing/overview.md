# AI service testing

Run commands from `services/ai/`:

```bash
make generate       # generate Python gRPC stubs
make test           # fast unit and in-process tests
make integration    # container-backed integration tests
make load-test      # k6 generation workload
make load-test-search
make lint
make format
```

The pytest `container` marker separates Docker-backed tests from the fast path.
When the protobuf contract changes, regenerate Python stubs here and Go stubs in
`services/content/` so both ends of the gRPC boundary use the same contract.
