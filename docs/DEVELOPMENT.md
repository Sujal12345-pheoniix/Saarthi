# Development Setup

## Prerequisites

- Node.js **22 LTS** (≥ 22.12; Prisma 7 does not support Node < 20.19 and Node 20 is end-of-life). `.nvmrc` is provided.
- Docker (PostgreSQL with pgvector, Redis, and the CV service).
- Python 3.10 only if you run the CV service outside Docker.

## First run

```bash
npm install                      # also runs prisma generate
cp .env.example .env             # fill Clerk keys at minimum; set AI_SERVICE_TOKEN to a random 64-hex string
npm run infra:up                 # PostgreSQL (saarthi + saarthi_test databases) and Redis
npm run db:migrate:deploy        # apply migrations to DATABASE_URL
npm run dev                      # web app on http://localhost:3000
npm run worker:dev               # in a second terminal: analysis worker
docker compose up -d ai          # CV service on http://localhost:8000 (uses AI_SERVICE_TOKEN from your shell/.env)
```

Without Cloudinary credentials, uploads return 503 `NOT_CONFIGURED`; questionnaire reports still work. Without an LLM key, combined reports fail with `LLM_NOT_CONFIGURED`.

## Everyday commands

| Command | Purpose |
|---|---|
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript rules) |
| `npm run format` / `format:check` | Prettier |
| `npm run test:unit` | Unit tests (no infrastructure) |
| `npm run test:integration` | Integration tests — needs `TEST_DATABASE_URL` and `TEST_REDIS_URL`; **wipes** that database |
| `npm test` | Both |
| `npm run ai:test` | Builds the CV service test image; pytest runs during the build |
| `npm run build` | Production build (needs no secrets) |
| `npm run queue:admin -- counts\|list\|retry <id>` | Inspect/retry failed analysis jobs |
| `npm run deps:check` | `npm outdated` + `npm audit --omit=dev` |
| `npm run db:migrate:dev -- --name <change>` | Create a new migration after editing `schema.prisma` |

## Conventions

- New API routes use `withAuth` (or `withPublic` for health only), validate input with Zod via `readJson`, and call a service in `server/services/`. Never accept a user id from the client.
- New queries that touch user data go in `server/repositories/` and take `userId` as a parameter.
- Never default a missing measurement. Use `null` and let the view-model render "Not measured".
- Every report write records `method` and `engineVersion`.
- Logging: `log.info("domain.event", { ...context })`; no bodies or personal text.
- Schema changes: edit `prisma/schema.prisma`, run `npm run db:migrate:dev`, review the generated SQL for data loss, add data-migration SQL when renaming or splitting columns.

## Testing notes

- Integration tests mock **only** Clerk's `auth()`/`currentUser()` (`tests/setup/integration.ts`); database, Redis, BullMQ, ownership and validation are real.
- `tests/integration/migration.test.ts` applies the real migration files to a scratch database seeded with legacy data and checks for schema drift.
- External services (Cloudinary, CV service, LLM) are replaced by in-memory fakes with the same contracts (`tests/helpers/fakes.ts`); the CV service itself has its own pytest suite.
