# Testing overview

Use the narrowest test level that can prove a change works. Unit tests should
be quick and not need Docker. Integration tests use real containers through
Testcontainers or Compose and therefore require Docker.

| Area | Unit tests | Integration tests |
| --- | --- | --- |
| AI | `make test` | `make integration` |
| Content | `make test` | `make test-integration` |
| User | `npm test` | `npm run test:integration` |
| Frontend | `npm test` | `npm run test:integration` |
| Seed Secrets | `make test` | `make test-all` includes its mocked integration tests |

Run formatting and lint checks from the relevant service directory before
opening a pull request. The exact source commands are in each package Makefile
or `package.json`.
