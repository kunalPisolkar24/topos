# Contributing to Topos

Thank you for improving Topos. This guide focuses on the pull-request process;
for architecture and service-specific commands, see [the documentation](docs/README.md)
and [AGENTS.md](AGENTS.md).

## Before you start

1. Branch from `dev`.
2. Give the branch one focused purpose, such as `feat/add-user-directory` or
   `fix/pagination-cursor`.
3. Read the guide for the area you will change.

## Make and check your change

Keep changes small, readable, and covered by an appropriate test. Run the
checks for the area you touched:

| Area | Required checks |
| --- | --- |
| AI service | `make test` and `make lint` in `services/ai/` |
| Content service | `make test`, `make vet`, and `make fmt` in `services/content/` |
| User service | `npm test` and `npm run lint` in `services/user/` |
| Frontend | `npm test` and `npm run lint` in `frontend/` |
| Seed Secrets | `make test` and `make lint` in `tools/seed-secrets/` |

Run the relevant integration test when a change uses Docker-backed storage or
messaging. Regenerate code after changing protobuf, Prisma, or GraphQL schema
sources; generated output is not edited by hand.

## Open a pull request

1. Use a concise imperative commit message, under roughly 72 characters.
   Example: `Add recommendation RPCs to the AI proto`.
2. Push the branch and open a pull request targeting `dev`.
3. Complete the repository pull-request template, including the checks you
   ran and any configuration or code-generation notes.

## Report a problem

Use the repository issue templates. Include the expected result, what happened,
the steps to reproduce it, and relevant OS, Docker, and runtime versions.
