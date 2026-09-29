# Topos documentation

This documentation is written for people who are new to the project as well as
people operating or extending it. It describes current behaviour from the
repository's code and configuration.

## New here?

1. [Prerequisites](getting-started/prerequisites.md) — install the small set of
   tools needed to run Topos.
2. [Quick start](getting-started/quickstart.md) — start the complete local stack.
3. [Architecture](concepts/architecture.md) — learn why the project has several
   services and how they communicate.
4. [Request and event flows](concepts/request-flows.md) — follow a post from the
   browser through background AI work.

## Browse by task

| If you want to… | Read this |
| --- | --- |
| Run Topos locally | [Quick start](getting-started/quickstart.md) |
| Configure a local or managed environment | [Configuration](getting-started/configuration.md) |
| Understand the platform | [Architecture](concepts/architecture.md) and [glossary](concepts/glossary.md) |
| Understand people and product capabilities | [Use cases](use-cases.md) |
| Work on one product area | [Component guides](components/README.md) |
| Deploy or debug the stack | [Operations](operations/README.md) |
| Run tests | [Testing overview](testing/overview.md) |

## Service guides

| Component | Guide |
| --- | --- |
| Frontend | [frontend/docs](../frontend/docs/README.md) |
| GraphQL gateway | [gateway/docs](../gateway/docs/README.md) |
| User service | [services/user/docs](../services/user/docs/README.md) |
| Content service | [services/content/docs](../services/content/docs/README.md) |
| AI service | [services/ai/docs](../services/ai/docs/README.md) |
| Infrastructure | [infrastructure/docs](../infrastructure/docs/README.md) |
| Seed Secrets tool | [tools/seed-secrets/docs](../tools/seed-secrets/docs/README.md) |

## Documentation rules

Commands and behaviour are linked to their source configuration when useful.
Mermaid diagrams are intentionally kept small, use GitHub-supported syntax,
and are accompanied by text so that the information is useful without a
rendered diagram.
