# Topos frontend

The frontend is the browser application for Topos. It is a single-page React
app served by Vite in development and by nginx in production. It talks to one
back end only: the GraphQL gateway at `VITE_GRAPHQL_URL`.

It never talks to Postgres, MongoDB, Redis, Qdrant, Kafka or the `ai` gRPC
service directly. Everything the UI shows comes back through the gateway.

## Stack

| Concern | Choice | Where it lives |
| --- | --- | --- |
| UI library | React 18 | `src/` |
| Build tool | Vite 6 | `vite.config.ts` |
| Routing | React Router 6 | `src/App.tsx` |
| Server state | Apollo Client 4 | `src/shared/api/` |
| Client state | Zustand 5 | `src/entities/session/store/` |
| Forms | React Hook Form + Zod | `src/features/blog/authoring/model/` |
| Styling | Tailwind CSS 3 + shadcn/ui primitives | `src/index.css`, `src/shared/ui/primitives/` |
| Rich text | `react-quill-new` 3 | `src/widgets/blog-editor/` |
| Toasts | `sonner` | `src/shared/ui/hooks/useToast.ts` |
| Tests | Vitest 4 + Testing Library + MSW 2 | `src/test/` |
| Codegen | `@graphql-codegen/cli` client preset | `codegen.ts` |

## Ports

| Port | What it is |
| --- | --- |
| `5173` | Vite dev server (`npm run dev`, `dev:preview`) |
| `3000` | nginx serving the built app in Docker (`docker/default.conf.template`) |
| `4000` | The gateway's `/graphql` endpoint, which the app points at |

## Commands

Run everything from this directory (`frontend/`).

| Command | What it does |
| --- | --- |
| `npm ci` | Install dependencies exactly as locked |
| `make dev` | Run against a real gateway on `localhost:4000` |
| `make dev-preview` | Run against seeded IndexedDB demo data, no back end needed |
| `npm run codegen` | Regenerate `src/shared/graphql/generated/` from the sibling service schemas |
| `npm run lint` | `eslint .` |
| `npm test` | Unit tests, integration tests excluded |
| `npm run test:integration` | The 5 `*.integration.test.tsx` files |
| `npm run test:coverage` | Coverage with an 80% threshold |
| `make build` | `codegen` then `tsc -b` then `vite build` |

`npm run build` is the only command that type-checks. `npm run lint` is
ESLint only; it does not run `tsc`.

## Where the code lives

```
src/
  main.tsx            entry point: providers, config probe, React root
  App.tsx             route table
  app/                providers, route guards, scroll behaviour
  entities/           business objects + their API repositories
  features/           user-facing use cases (auth, blog, chat, search, preview)
  widgets/            composed blocks (navbar, editor, pagination)
  pages/              one component per route
  shared/             api, config, graphql, lib, ui, domain helpers
  mocks/              MSW handlers for mock and preview modes
  test/               test setup, MSW server, render helper
```

The layers are enforced by ESLint, not by convention. See
[Application architecture](docs/concepts/architecture.md).

## Start here

| If you want to… | Read |
| --- | --- |
| Run the app for the first time | [Quick start](docs/getting-started/quickstart.md) |
| Understand environment variables | [Configuration](docs/getting-started/configuration.md) |
| Learn how the code is organised | [Application architecture](docs/concepts/architecture.md) |
| Follow a user action end to end | [Request flows](docs/concepts/request-flows.md) |
| Change a GraphQL operation | [Data model](docs/concepts/data-model.md) |
| Run the tests | [Testing overview](docs/testing/overview.md) |

The full index is [docs/README.md](docs/README.md).
