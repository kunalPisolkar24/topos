# Content service testing

Run commands from `services/content/`.

```bash
make test               # unit tests
make test-integration   # MongoDB, Redis, and Kafka integration tests
make vet                # Go static analysis
make fmt                # formatting check
make generate           # protobuf and GraphQL generation
```

Use integration tests for code that touches MongoDB, Redis, Kafka, or the AI
client. Generated GraphQL and protobuf files are outputs: change the schema or
proto source, regenerate, then commit only source files that the repository
tracks.
