# Saarthi Architecture (Phase 1)

Status: reflects the code on branch `phase-1-foundation`. Pre-Phase-1 state is recorded in `docs/audit/`.

## 1. System overview

```
 Browser (Next.js pages, Clerk session cookie)
    │  HTTPS, same-origin JSON / multipart
    ▼
 Next.js 16 web app ──────────────── proxy.ts (Clerk; protects /dashboard pages)
   app/api/*  → lib/api/handler.ts (withAuth: request id, origin check, auth, rate limit, envelope)
             → server/services/*  → server/repositories/* → PostgreSQL (Prisma)
             → lib/storage        → Cloudinary (private "authenticated" assets)
             → lib/queue          → Redis (BullMQ "saarthi-analysis")
                                            │
                                            ▼
 Analysis worker (separate process: npm run worker)
   workers/analysis/index.ts → server/services/analysis-processor.ts
             → storage download (lib/security/safe-fetch.ts)
             → CV service  (server/integrations/ai-service.ts, image BYTES + bearer token)
             → LLM provider (server/integrations/llm/*, combined reports only)
             → PostgreSQL (one transaction per completed analysis)

 CV service (ai-service/, FastAPI + OpenCV + MediaPipe)
   POST /v1/analyze/skin | /v1/analyze/fitness   (multipart image, Bearer AI_SERVICE_TOKEN)
```

| Process | Entry | Scales | Needs |
|---|---|---|---|
| Web | `next start` | horizontally (stateless) | Postgres, Clerk, Redis (queue mode), Cloudinary |
| Worker | `npm run worker` | horizontally (BullMQ coordinates; `WORKER_CONCURRENCY` per process) | Postgres, Redis, Cloudinary, CV service, LLM key |
| CV service | `uvicorn app.main:app` | horizontally (stateless) | nothing but its token |

## 2. Repository layout

| Path | Responsibility |
|---|---|
| `app/` | Next.js routes. `app/api/**/route.ts` files are thin: parse → call a service → return data. |
| `components/` | UI components (visual identity preserved from pre-Phase-1). |
| `features/` | Domain logic shared by server and UI: questionnaire schemas & rules (`wellness/`), CV response contract (`analysis/`), report view-models (`reports/`). No I/O. |
| `lib/api/` | HTTP infrastructure: `handler.ts` (wrapper), `errors.ts`, `contracts.ts` (response envelope), `body.ts` (size-limited JSON), `client.ts` (browser helper). |
| `lib/auth/` | `session.ts` — the only way to get the current user. |
| `lib/config/` | `env.ts` — validated configuration. |
| `lib/database/` | Prisma client. |
| `lib/logging/` | Structured JSON logger with redaction. |
| `lib/queue/` | Redis connections and the analysis queue contract. |
| `lib/security/` | Origin check, rate limiting, image verification, SSRF-safe fetch. |
| `lib/storage/` | Storage provider abstraction (Cloudinary implementation). |
| `server/repositories/` | Queries. Every function takes the internal `userId` and filters by it. |
| `server/services/` | Use cases: analysis creation/processing/recovery, questionnaire reports, assets, account, dashboard, audit. |
| `server/integrations/` | External systems: CV service client, LLM providers. |
| `workers/analysis/` | Worker process entry point. |
| `prisma/` | `schema.prisma` and SQL migrations. |
| `ai-service/app/` | Python CV service: `api/`, `core/` (config), `security/` (auth), `services/` (image IO, skin, posture), `schemas/`. |
| `tests/` | `unit/` (no infrastructure) and `integration/` (real PostgreSQL + Redis). |

Deliberate deviations from the suggested target structure: there is no `src/` prefix (the existing Next.js project uses the root), `features/` holds pure domain code rather than UI, and `server/policies/` was not created because ownership is enforced inside repository queries (one place, no separate policy objects to forget to call). See `docs/SECURITY_ARCHITECTURE.md` § Authorization.

## 3. Request lifecycle (`withAuth`)

1. Request id: incoming `x-request-id` if well-formed, else a UUID. Returned in the header and the body.
2. Origin check for non-GET methods (`lib/security/origin.ts`).
3. Authentication: `requireUser()` resolves the Clerk session to the internal `User` (created on first request).
4. Rate limit per internal user id and route budget (`RATE_LIMITS`).
5. Handler runs; its return value becomes `{ success: true, data, requestId }`.
6. Errors: `AppError` → its status/code/message; anything else → 500 `INTERNAL_ERROR` with a generic message. Logged as `request.failed` with the request id.

API conventions: `docs/api/API_CONVENTIONS.md`.

## 4. Analysis lifecycle

```
POST /api/analyze-skin {assetId}
  → asset ownership + purpose check
  → Analysis(QUEUED) + AnalysisInput              ─┐ idempotencyKey dedupes
  → dispatch: queue (default) | inline              │
                                                    ▼
worker/inline: processAnalysis(id)
  claim:  UPDATE ... SET status=PROCESSING WHERE status=QUEUED (or PROCESSING and stale > 10 min)
  load:   asset → storage download → verify signature + SHA-256 matches upload
  run:    CV service (skin/fitness) | LLM synthesis (combined)
  commit: ONE transaction → AnalysisResult + Report + ProgressHistory + Achievement + status=COMPLETED
  fail:   retryable & attempts left → status=QUEUED (BullMQ retries with exponential backoff 5s, 10s)
          otherwise → status=FAILED, errorCode, user-safe errorMessage
GET /api/report/{analysisId} → status, or the report view-model when COMPLETED
```

- **Retry policy:** 3 attempts, exponential backoff from 5 s. Non-retryable failures (image rejected, auth/config errors, invalid responses) throw `UnrecoverableError` and are not retried.
- **Idempotency & duplicates:** BullMQ `jobId = analysisId`; the conditional claim prevents double processing; `(userId, idempotencyKey)` is unique.
- **Timeouts:** CV call `AI_SERVICE_TIMEOUT_MS` (60 s), storage download 20 s, LLM `LLM_TIMEOUT_MS` (120 s), BullMQ lock 120 s.
- **Failed jobs / dead letter:** failed jobs are kept 14 days; `npm run queue:admin -- list | counts | retry <id>`.
- **Recovery:** on start and every 5 minutes the worker reconciles stale QUEUED (> 2 min) / PROCESSING (> 10 min) analyses with Redis: missing job → re-enqueue; failed job → mark FAILED.
- **No silent fallback:** if Redis is unreachable in queue mode, the analysis is marked FAILED (`QUEUE_UNAVAILABLE`) and the API returns 503. `inline` mode is an explicit configuration choice, not a fallback.
- **Questionnaire reports** (`POST /api/reports/{domain}`) are computed synchronously but still create a COMPLETED `Analysis`, its `AnalysisInput` and `AnalysisResult`, so every report has the same provenance trail.

## 5. Data provenance rules

Every report row carries `method` (`COMPUTER_VISION`, `QUESTIONNAIRE_RULES`, `LLM_SYNTHESIS`, `LEGACY_UNVERIFIED`) and `engineVersion`; raw engine output is kept in `AnalysisResult`. Values that were not measured are `NULL` and rendered "Not measured". The combined overall score is computed by Saarthi (mean of latest verified domain scores); the language model writes narrative only. Details: `docs/DATABASE_ARCHITECTURE.md`.

## 6. Logging conventions

- One JSON object per line: `level`, `time`, `msg`, `service`, plus context.
- Web: `requestId`, `method`, `path`, `userId` (internal id). Worker: `jobId`, `analysisId`, `attempt`.
- Event names are dotted (`request.failed`, `analysis.completed`, `job.failed`, `recovery.completed`).
- Never log bodies, questionnaire answers, journal text, image bytes or signed URLs. Keys matching secret/PII patterns are redacted automatically (`lib/logging/logger.ts`).

## 7. Configuration

All server configuration goes through `lib/config/env.ts` (validated, typed, lazy). `instrumentation.ts` validates at web-server start; the worker validates at its own start. Reference: `docs/deployment/ENVIRONMENT_CONFIGURATION.md`.

## 8. What is not built yet

AI companion chat (Phase 3), recommendation engine and calibrated CV/scoring methods (Phase 2), consent capture UI and account-deletion UI (Phase 3), CSP and observability backends (Phase 4). The corresponding tables exist (`AIConversation`, `AIMessage`, `Recommendation`, `ConsentRecord`, `JournalEntry`, `DailyHabit`, `Notification`) but have no API yet.
