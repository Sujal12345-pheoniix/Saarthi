# Phase 1 Completion Report — Engineering Foundation, Architecture and Security

Branch: `phase-1-foundation` (uncommitted working tree; nothing has been pushed) · Date: 2026-11-13 · Base commit: `a0fc041`

**This is not a production-readiness claim.** Phase 1 establishes a secure, consistent foundation. Known gaps are listed in § 8.

## 1. Summary

The audit (`docs/audit/`) found three critical security holes (unauthenticated endpoints trusting a client `userId`, anonymous uploads with a client-chosen folder, SSRF in the CV service), two critical data-integrity problems (an LLM "analysing" images it never saw; a stock photo analysed as the user's body), five overlapping report tables, an unused MongoDB layer, no migrations, a worker embedded in the web server, and no tests.

Phase 1 closes those, consolidates PostgreSQL as the single source of truth with data-preserving migrations, separates the worker, adds validated configuration and shared API infrastructure, and adds automated tests that run against real PostgreSQL and Redis.

## 2. Acceptance criteria

| Gate item | Status | Evidence |
|---|---|---|
| Authentication | Verified with mocked Clerk | `tests/integration/auth-and-ownership.test.ts`: unauthenticated requests are rejected on every protected route. A deliberately forced dev bypass caused 15 failures. Not run against real Clerk (see § 8). |
| Ownership / IDOR | Verified | Cross-user reads, deletes and analysis references return 404. With the `userId` filter deliberately removed, the test "Bob cannot read Alice's analysis" failed. |
| `DEV_ALLOW_ANON` cannot bypass auth in production | Verified | `tests/unit/config/env.test.ts`: rejected at startup when `APP_ENV`/`NODE_ENV` is not development. |
| Database consistency | Verified | `prisma migrate diff` between the migrations and `schema.prisma` is empty. FKs, unique constraints and ownership are exercised by the integration suite. |
| Migration (data-preserving) | Verified on test data | `tests/integration/migration.test.ts` seeds old-format rows, applies the Phase 1 migration and asserts transformed data. A failure mid-migration rolled back fully (observed during development). |
| Foundational security | Verified | Unit tests cover the env schema, image validation, SSRF fetcher, body limits/origin, and the error envelope. Integration tests cover upload validation, rate limiting and the queue/worker lifecycle. The CV service has 31 pytest tests plus a container smoke test. |

## 3. What changed

### Security
- Single authentication path (`lib/auth/session.ts`) and route wrapper (`lib/api/handler.ts`) on every API route; `DEV_ALLOW_ANON` only possible in local development and rejected at startup elsewhere.
- Ownership enforced in every query; foreign ids return 404. Three IDOR routes deleted.
- Uploads: authenticated, rate limited, magic-byte type detection, header-parsed dimensions, size limits, server-generated user-scoped keys, private Cloudinary `authenticated` assets, short-lived signed URLs, SHA-256 integrity re-check before analysis, deletion endpoint.
- SSRF: CV service accepts image bytes only (URL endpoints return 410); worker downloads through an allow-listed, DNS-checked, no-redirect, size/time-limited fetcher.
- CV service: bearer-token auth, refuses to start without a token in staging/production, docs disabled in production, non-root container, byte/dimension/decompression-bomb validation.
- Origin (CSRF) check, Redis rate limiting, body size limits, safe error envelope with request ids, security headers, structured logging with redaction, audit log, account export/deletion APIs.
- Next.js upgraded 16.2.6 → 16.4.6 to remove critical advisories (incl. a middleware/proxy bypass and unauthenticated RCEs).

### Data integrity
- Removed: LLM fallback that fabricated CV results; stock-photo substitution; default values for missing analysis fields; hard-coded skin confidence (95); `mobility = posture + 5`; formula "confidence" on questionnaire reports; UI confidence fallbacks; hard-coded dashboard metrics and chart; mock AI companion replies.
- Fixed a posture-angle orientation bug that pinned every frontal photo to the minimum score (INT-10).
- Every report records `method` and `engineVersion`; raw engine output stored in `AnalysisResult`; unmeasured values are `NULL` and shown as "Not measured"; combined overall score computed by Saarthi, never by the model.

### Architecture
- PostgreSQL/Prisma canonical; MongoDB/Mongoose removed (unused). 21 models with enums, FKs, unique constraints and indexes; `Analysis` ↔ report via unique `analysisId`.
- Migrations: exact baseline + hand-written data-preserving Phase 1 migration (single transaction).
- Standalone worker with retries/backoff, non-retryable classification, idempotent claiming, timeouts, failed-job retention + admin CLI, stale-job recovery. Explicit `queue`/`inline` execution modes; no silent fallback.
- LLM provider abstraction: Anthropic (official SDK, structured outputs, default `claude-opus-5-5`), Gemini and OpenAI-compatible (kept for existing deployments); all outputs Zod-validated.
- Python service restructured into `app/{api,core,security,services,schemas}`.

## 4. Files

**Created (106)** — grouped:
- Configuration & tooling: `.env.example`, `.nvmrc`, `.editorconfig`, `.prettierrc.json`, `.prettierignore`, `docker-compose.yml`, `vitest.config.mts`, `scripts/init-test-db.sql`, `scripts/queue-admin.ts`
- Infrastructure (`lib/`): `api/{body,client,contracts,errors,handler}.ts`, `auth/session.ts`, `config/env.ts`, `database/prisma.ts`, `logging/logger.ts`, `queue/{analysis-queue,connection}.ts`, `security/{image-validation,origin,rate-limit,safe-fetch}.ts`, `storage/storage.ts`
- Domain (`features/`): `analysis/cv-contract.ts`, `reports/view-model.ts`, `wellness/{rules,schemas}.ts`
- Server (`server/`): `integrations/ai-service.ts`, `integrations/llm/{anthropic,http-providers,index,types}.ts`, `repositories/{analyses,assets,reports}.ts`, `services/{account,analysis-errors,analysis-processor,analysis-service,assets,audit,combined-report,dashboard,questionnaire-reports,recovery}.ts`
- Worker: `workers/analysis/index.ts`
- API routes: `app/api/{account,account/export,assets/[id],dashboard/summary,health}/route.ts`
- Database: `prisma/migrations/20261113000000_baseline/migration.sql`, `prisma/migrations/20261113000100_phase1_foundation/migration.sql`, `prisma/migrations/migration_lock.toml`
- CV service: `ai-service/app/{main.py, api/routes.py, core/config.py, security/auth.py, services/{image_io,skin,fitness}.py, schemas/analysis.py}` (+ `__init__.py` files), `ai-service/tests/{conftest,test_api,test_image_io,test_posture_geometry}.py`, `ai-service/requirements-dev.txt`, `ai-service/.dockerignore`
- Tests: `tests/setup/{unit,integration,integration-global}.ts`, `tests/helpers/{fakes,http,images}.ts`, 6 unit and 6 integration test files
- Documentation: `docs/audit/{INITIAL_AUDIT,ARCHITECTURE_FINDINGS,SECURITY_FINDINGS,TECHNICAL_DEBT}.md`, `docs/{ARCHITECTURE,DATABASE_ARCHITECTURE,SECURITY_ARCHITECTURE,DEVELOPMENT}.md`, `docs/api/API_CONVENTIONS.md`, `docs/deployment/ENVIRONMENT_CONFIGURATION.md`, this report

**Modified (28):** `.gitignore`, `README.md`, `package.json`, `package-lock.json`, `instrumentation.ts`, `next.config.ts`, `prisma.config.ts`, `prisma/schema.prisma`, `ai-service/Dockerfile`, `ai-service/requirements.txt`; API routes `analyze-fitness`, `analyze-skin`, `history`, `progress`, `report/[id]`, `report/generate`, `report/latest`, `reports/[domain]`, `upload`; pages `dashboard`, `dashboard/ai`, `dashboard/reports`, `dashboard/settings`; components `Sidebar`, `Navbar`, `SkinReportView`, `PhysicalReportView`, `MentalReportView` (visual design preserved; data flow, honesty labels and API contract changed).

**Renamed (1):** `middleware.ts` → `proxy.ts` (Next.js 16 convention).

**Deleted (26):** IDOR routes `app/api/{skin,mental,physical}/analyze/route.ts`; unused MongoDB layer `lib/mongodb.ts`, `models/*.ts` (4); unused/fabricating AI code `lib/ai/{orchestrator,gemini,prompts,directAnalyzer}.ts`, `lib/ai/agents/*.ts` (4), `lib/validations/ai.ts`; replaced modules `lib/prisma.ts`, `lib/wellness-report.ts`, `lib/queue/{redis,reportQueue,reportWorker}.ts`; `ai-service/main.py`, `ai-service/test_analysis.py`, committed `__pycache__`; `scripts/smoke-test.js`. All recoverable from `a0fc041`.

**Dependencies:** added `@anthropic-ai/sdk`, `dotenv`, `tsx`; dev `vitest`, `prettier`, `@types/node@22`. Removed unused `mongoose`, `uploadthing`, `@uploadthing/react`, `@google/genai`, `zustand`, `clsx`, `tailwind-merge`, `@types/pg`; Python `requests` (no URL fetching remains). Upgraded `next` / `eslint-config-next` 16.2.6 → 16.4.6.

## 5. Database decisions

See `docs/DATABASE_ARCHITECTURE.md`. Highlights: one report table per domain with `method`; legacy CV reports and legacy combined scores marked `LEGACY_UNVERIFIED` (their provenance cannot be proven); derived legacy values preserved under `metrics.legacy` rather than discarded; in-flight legacy jobs failed honestly; journal text never stored; `UploadedAsset` is the only soft-deleted table; no Subscription table (no billing exists).

## 6. Tests executed and exact results

All commands were run on 2026-11-13 on Windows 11 with Node 22.23.5, after the Next.js 16.4.6 upgrade. They were run against disposable PostgreSQL 16 (pgvector) and Redis 7 containers.

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0, no errors |
| `npx eslint .` | 0 errors, 5 warnings (`@next/next/no-img-element`, TD-18) |
| `npx vitest run --project unit` | **6 files, 77 / 77 passed** |
| `TEST_DATABASE_URL=… TEST_REDIS_URL=… npx vitest run --project integration` | **6 files, 73 / 73 passed** (real PostgreSQL + Redis; schema rebuilt via `prisma migrate deploy`) |
| `docker build --target test ai-service` (runs `pytest`) | **31 / 31 passed**, 1 third-party deprecation warning |
| CV runtime container smoke test | Refuses to start in production without a token. With a token: `/health` 200, no token 401, JSON URL payload 400, legacy `/analyze-*` 410, `/docs` 404. Process runs as user `saarthi` (uid 10001). |
| `npx prisma migrate diff --from-migrations … --to-schema-datamodel …` | empty (no drift) |
| Standalone worker (`npm run worker`) on a real queued COMBINED job | Job marked `FAILED` with `LLM_NOT_CONFIGURED`, attempts = 1, not retried, no report fabricated |
| Mutation checks (temporary code changes, reverted and verified by grep) | Forced auth bypass: 15 failing tests. Removed ownership filter: IDOR test fails. |

Not executed: an end-to-end browser run with real Clerk, real Cloudinary uploads, and LLM calls (no credentials were available on disk; see § 8), and worker SIGTERM drain (TD-19).

## 7. Build status

- `npx next build` (Next.js 16.4.6, Turbopack) ran with no secrets present: **compiled successfully**. TypeScript passed, and 22 static pages and 16 API routes were generated, plus the proxy. Exit code 0.
- `npm audit --omit=dev`: **0 vulnerabilities** in production dependencies.
- `npm audit` (including dev): 8 moderate advisories, all in the lint toolchain only (`minimatch` ReDoS via `typescript-eslint` ← `eslint-config-next`). The only automated fix downgrades `eslint-config-next` to 15.x, which is incompatible with Next 16, so the advisories are accepted until upstream releases a fix. Lint is not shipped to production.
- `next` and `eslint-config-next` are pinned exactly to `16.4.6`.

## 8. Remaining blockers and limitations

1. **Credentials.** The Anthropic, Clerk and Cloudinary keys and a production `DATABASE_URL` were not available on disk during verification. The `.env` the user referenced (`app/api/.env`) was empty (0 bytes) when checked. Note that Next.js reads env files only from the project root, so the file must be at `./.env`, not `app/api/.env`. Until keys are configured:
   - combined (LLM) reports fail honestly with `LLM_NOT_CONFIGURED`;
   - there has been no real Clerk sign-in run (TD-22) and no real Cloudinary upload.
2. **Deployed CV service** (Render). It must be redeployed from the new Dockerfile with `APP_ENV=production` and an `AI_SERVICE_TOKEN` of at least 32 characters. The old deployment still exposes the SSRF-prone URL endpoints until then.
3. **Existing production database.** Take a backup, run `npm run db:baseline`, then `npm run db:migrate:deploy`. The migration was verified on seeded test data, not on a copy of production.
4. **Legacy Cloudinary assets** are public `upload`-type (TD-21). They need migration or deletion.
5. **CV accuracy.** There are no positive-path golden images (TD-20), and thresholds are uncalibrated (TD-11). This is Phase 2 work.
6. **Worker graceful shutdown** has not been exercised on Linux (TD-19).
7. **CSP** is not yet set (TD-13). Pervasive `any` remains in UI components (TD-02).
8. **Version control.** Nothing has been committed or pushed. The working tree is unstaged relative to `a0fc041`.

## 9. Required environment variables

Full reference: `docs/deployment/ENVIRONMENT_CONFIGURATION.md`; template: `.env.example`.

Strict (staging/production) minimum: `APP_ENV`, `APP_URL`, `DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `REDIS_URL` (queue mode), `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `AI_SERVICE_URL` (https), `AI_SERVICE_TOKEN` (≥ 32 chars, same value in the CV service). For combined reports: `ANTHROPIC_API_KEY` (or `GEMINI_API_KEY` / OpenAI-compatible trio). CV service: `APP_ENV`, `AI_SERVICE_TOKEN`.

## 10. How to start the application and worker

```bash
# 0. Node 22 (nvm use), Docker running
npm install
cp .env.example .env                 # fill Clerk keys; set AI_SERVICE_TOKEN (64 hex chars)
npm run infra:up                     # PostgreSQL (pgvector) + Redis
npm run db:migrate:deploy            # fresh DB. Existing db-push DB: back up, `npm run db:baseline`, then deploy
docker compose up -d ai              # CV service on :8000
npm run dev                          # web app (or: npm run build && npm start)
npm run worker                       # analysis worker, separate terminal/process
```

Production: deploy the web app (e.g. Vercel) with `ANALYSIS_EXECUTION_MODE=queue`, run `npm run worker` as a long-running process (e.g. Render/Railway/Fly worker or a container), deploy `ai-service` from its Dockerfile (`runtime` target) with `APP_ENV=production` and the same `AI_SERVICE_TOKEN`, and run `npm run db:migrate:deploy` as a release step. If no worker host is available, `ANALYSIS_EXECUTION_MODE=inline` processes analyses inside the request (subject to the platform's request timeout).
