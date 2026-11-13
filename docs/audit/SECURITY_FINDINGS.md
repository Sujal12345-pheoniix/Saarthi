# Security Findings — Initial Audit (Phase 1)

Audit date: 2026-11-13 · Commit audited: `a0fc041` (branch `master`)

Severity scale: **Critical** (exploitable now, cross-user or infrastructure impact) · **High** · **Medium** · **Low** · **Info**.

Each finding lists its status after Phase 1. "Resolved" means a code change exists **and** a test or a reproducible check covers it (see `PHASE_1_COMPLETION_REPORT.md` for the exact test results).

---

## SEC-01 — Unauthenticated endpoints trust a client-supplied `userId` (IDOR)

| | |
|---|---|
| Files | `app/api/skin/analyze/route.ts`, `app/api/mental/analyze/route.ts`, `app/api/physical/analyze/route.ts` |
| Severity | **Critical** |
| Problem | The routes never call Clerk. They read `userId` from the JSON body and enqueue a `report-generation` job for that user. The worker writes a `CombinedWellnessReport` row for the given id. |
| Impact | Any anonymous caller can write AI-generated reports into any user's account and burn paid LLM quota. |
| Proposed solution | Remove the three routes (the UI does not call them). All analysis creation goes through authenticated routes that resolve the user on the server. |
| Verification | Route files deleted. `tests/integration/auth-and-ownership.test.ts` asserts 401 on all 14 protected routes and that a body `userId` is rejected (400) and never used. |
| Status | Resolved in Phase 1. |

## SEC-02 — Anonymous uploads, client-controlled folder, MIME type trusted

| | |
|---|---|
| File | `app/api/upload/route.ts` |
| Severity | **Critical** |
| Problem | (a) No authentication. (b) `folder` comes from the form and is passed straight to Cloudinary. (c) The type check only runs when the browser sends a type (`if (fileType && ...)`), so an empty type skips validation entirely; the bundled smoke test uploads an SVG. (d) Bytes are never inspected. (e) Assets are created as public `upload` type. |
| Impact | Anyone can use the Cloudinary account for arbitrary hosting, write into any folder, and upload non-image content. Face and body photos are publicly reachable by URL forever. |
| Proposed solution | Require a session; replace `folder` with a server-side `purpose` enum; build the storage path from the internal user id; verify magic bytes and decode image dimensions on the server; store assets as Cloudinary `authenticated` type; record ownership in `UploadedAsset`; issue short-lived signed URLs. |
| Verification | `tests/unit/security/image-validation.test.ts`, `tests/integration/upload-and-validation.test.ts`. |
| Status | Resolved in Phase 1. |

## SEC-03 — Server-side request forgery in the Python AI service

| | |
|---|---|
| File | `ai-service/main.py` (`download_image`) |
| Severity | **Critical** |
| Problem | `requests.get(url, timeout=10)` fetches any URL supplied by the caller. Redirects are followed, there is no host allow-list, no private-IP check, no size cap (`response.content` buffers everything), and the exception text (including the URL) is echoed back in the 400 response. The URL originates from the browser (`imageUrl` in `/api/analyze-skin`). |
| Impact | A user can make the Render-hosted service request internal addresses (cloud metadata endpoints, private network services) and learn about responses from error text; memory exhaustion via large downloads. |
| Proposed solution | The Python service no longer fetches URLs at all. It accepts image **bytes** (multipart) from the trusted worker. The worker resolves an owned `UploadedAsset` id to a storage key and downloads it through `lib/security/safe-fetch.ts` (HTTPS only, host allow-list, DNS private-range rejection, no redirects, timeout, byte cap, content-type and magic-byte checks). Python re-validates signature, size, dimensions and decompression-bomb limits. |
| Verification | `tests/unit/security/safe-fetch.test.ts`; `ai-service/tests/test_api.py::test_url_payload_rejected` and `::test_legacy_url_endpoints_are_gone`. |
| Status | Resolved in Phase 1. |

## SEC-04 — Python AI service has no authentication

| | |
|---|---|
| Files | `ai-service/main.py`; `lib/ai/directAnalyzer.ts:9` (hard-coded public URL `https://saarthi-qqcm.onrender.com`) |
| Severity | **High** |
| Problem | The inference API is public and unauthenticated; its URL is committed in source. |
| Impact | Free use of compute by anyone; direct access to the SSRF in SEC-03. |
| Proposed solution | Require `Authorization: Bearer <AI_SERVICE_TOKEN>` (constant-time comparison) on every analysis endpoint; refuse to start in production without a token; remove the hard-coded URL. |
| Verification | `ai-service/tests/test_api.py::test_requires_token`. |
| Status | Resolved in code. The deployed Render instance must be redeployed with `AI_SERVICE_TOKEN` set — until then the old public service remains exposed. |

## SEC-05 — `DEV_ALLOW_ANON` is an authentication bypass in every environment

| | |
|---|---|
| Files | 8 route files (`ensureDatabaseUser` / `checkAuth` copies); `app/api/reports/[domain]/route.ts:233` |
| Severity | **High** |
| Problem | If `DEV_ALLOW_ANON=true` is set (including accidentally in production) every request is treated as the shared user `dev_local_id`. Additionally, `reports/[domain]` falls back to the shared dev user whenever a DB error mentions "relation" and `NODE_ENV !== 'production'` (true on preview/staging deployments). |
| Impact | Complete auth bypass; all anonymous visitors share one account's health data. |
| Proposed solution | Single helper `lib/auth/session.ts`. The bypass is honored only when `NODE_ENV === 'development'` **and** `APP_ENV === 'development'`. Environment validation rejects `DEV_ALLOW_ANON=true` outside development at startup. The DB-error fallback is removed. |
| Verification | `tests/unit/config/env.test.ts` (refused for 4 env combinations) and `tests/integration/auth-and-ownership.test.ts` (bypass not honoured outside development). Mutation-tested: forcing the bypass on makes 15 tests fail. |
| Status | Resolved in Phase 1. |

## SEC-06 — Analysis accepts arbitrary image URLs not owned by the user

| | |
|---|---|
| Files | `app/api/analyze-skin/route.ts`, `app/api/analyze-fitness/route.ts` |
| Severity | **High** |
| Problem | `imageUrl` from the body is stored and analysed without any ownership check. |
| Impact | Feeds SEC-03; lets users store results for images that are not theirs; the stored URL is later rendered in `<img>`. |
| Proposed solution | Routes accept an `assetId`; the server verifies `UploadedAsset.userId === currentUser.id` and `status = ACTIVE`. |
| Verification | `tests/integration/auth-and-ownership.test.ts` › "Bob cannot analyse Alice's uploaded image"; `tests/integration/upload-and-validation.test.ts` › "rejects the pre-Phase-1 imageUrl contract". |
| Status | Resolved in Phase 1. |

## SEC-07 — Internal error messages returned to clients

| | |
|---|---|
| Files | All route handlers (`error.message` returned verbatim) |
| Severity | **Medium** |
| Problem | Provider responses, Prisma errors and configuration hints are sent to the browser. |
| Impact | Information disclosure (infrastructure, schema, provider error bodies). |
| Proposed solution | Shared `AppError` hierarchy and `withApi` wrapper: only `AppError` messages marked `expose` reach clients; everything else becomes `INTERNAL_ERROR` with a `requestId` for correlation. |
| Verification | `tests/unit/api/errors.test.ts` (generic 500 body), `tests/unit/api/body-and-origin.test.ts` (no echoed values); `tests/integration/analysis-lifecycle.test.ts` › "unexpected errors are stored as a generic message". |
| Status | Resolved in Phase 1. |

## SEC-08 — Gemini API key sent in URL query string

| | |
|---|---|
| File | `lib/queue/reportWorker.ts:178` |
| Severity | **Medium** |
| Problem | `...:generateContent?key=${apiKey}` puts the secret in the URL, where proxies and error logs capture it. |
| Proposed solution | Send keys in headers (`x-goog-api-key`, `x-api-key`, `Authorization`). |
| Verification | Code review of `server/integrations/llm/*`. |
| Status | Resolved in Phase 1. |

## SEC-09 — No rate limiting

| | |
|---|---|
| Files | All routes |
| Severity | **Medium** |
| Problem | No limits on uploads, analysis creation or LLM report generation. |
| Impact | Cost amplification (LLM, Cloudinary, CV compute) and abuse. |
| Proposed solution | Redis fixed-window limiter (`lib/security/rate-limit.ts`) keyed by internal user id, with per-route budgets. |
| Verification | `tests/integration/account-and-ratelimit.test.ts` (real Redis; 429 + Retry-After from a route). |
| Status | Resolved in Phase 1 (fails open with a logged warning if Redis is down — documented trade-off). |

## SEC-10 — No request size limits on JSON bodies; uploads buffered before checks

| | |
|---|---|
| Files | All `request.json()` calls; `app/api/upload/route.ts` |
| Severity | **Medium** |
| Proposed solution | `readJsonBody(req, maxBytes)` streams with a cap; uploads reject on `Content-Length` before parsing. |
| Verification | `tests/unit/api/body-and-origin.test.ts`; `tests/integration/upload-and-validation.test.ts` (upload 413). |
| Status | Resolved in Phase 1. |

## SEC-11 — No origin check on state-changing requests (CSRF defence in depth)

| | |
|---|---|
| Files | All POST routes |
| Severity | **Medium** (mitigated by Clerk's `SameSite=Lax` session cookie) |
| Proposed solution | Reject non-GET requests whose `Origin` header is present and not in the allowed origin list. No CORS headers are emitted, so cross-origin reads remain blocked by the browser. |
| Verification | `tests/unit/api/body-and-origin.test.ts`; `tests/integration/upload-and-validation.test.ts` › "rejects cross-origin state-changing requests". |
| Status | Resolved in Phase 1. |

## SEC-12 — Sensitive images are public and never deleted

| | |
|---|---|
| File | `app/api/upload/route.ts` |
| Severity | **Medium** |
| Proposed solution | Cloudinary `type: "authenticated"`; short-lived signed URLs; `DELETE /api/assets/[id]` and account deletion remove the stored file. |
| Verification | `tests/integration/upload-and-validation.test.ts`, `tests/integration/account-and-ratelimit.test.ts`. |
| Status | Resolved for new uploads. **Existing public images uploaded before Phase 1 remain public** until migrated or deleted — see completion report. |

## SEC-13 — Partial database password logged

| | |
|---|---|
| File | `lib/prisma.ts:21` |
| Severity | **Medium** |
| Problem | `DATABASE_URL.slice(0, 40).replace(/:.+@/, ...)` — when the 40-character slice ends before `@`, the regex does not match and the beginning of the password is logged. |
| Proposed solution | Remove the log; structured logger redacts secret-looking keys. |
| Status | Resolved in Phase 1. |

## SEC-14 — Custom `.env` loaders override real environment variables

| | |
|---|---|
| Files | `prisma.config.ts`, `ai-service/main.py:21` |
| Severity | **Medium** |
| Problem | Both loaders assign unconditionally, so a stray `.env` beats platform-provided secrets. The Python service loads the **Next.js app's** `.env` (`../.env`), giving it every web secret. |
| Proposed solution | Prisma config uses `dotenv/config` semantics (never overrides). Python reads only its own environment via `pydantic` settings. |
| Status | Resolved in Phase 1. |

## SEC-15 — LLM output trusted without validation; prompt injection surface

| | |
|---|---|
| File | `lib/queue/reportWorker.ts` |
| Severity | **Medium** |
| Problem | User questionnaire/journal text is interpolated into prompts and the JSON reply is saved with defaults (`overallHealthScore ?? 70`). |
| Proposed solution | Zod-validate every LLM response; reject (fail the job) instead of defaulting; user content is delimited as data in the prompt. |
| Status | Resolved in Phase 1 (schema validation). Prompt-injection hardening beyond delimiting is Phase 2. |

## SEC-16 — Missing security headers

| | |
|---|---|
| File | `next.config.ts` |
| Severity | **Low** |
| Proposed solution | `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, `Strict-Transport-Security`. A Content-Security-Policy is deferred to Phase 4 because Clerk requires a tuned policy. |
| Status | Resolved (except CSP). |

## SEC-17 — No account export or deletion

| | |
|---|---|
| Severity | **Low** (privacy/compliance gap) |
| Proposed solution | `GET /api/account/export`, `DELETE /api/account` (authenticated, rate limited, audited). |
| Status | Resolved in Phase 1 (API only; UI in Phase 3). |

## SEC-18 — Committed credentials scan

| | |
|---|---|
| Severity | **Info** |
| Method | `git grep` across **all 24 commits** for provider key patterns (OpenAI `sk-`, Google `AIza`, NVIDIA `nvapi-`, Clerk `sk_live`/`sk_test_`/`pk_test_`, connection strings with embedded passwords for Postgres/Redis/MongoDB, `cloudinary://`). Listed every file ever added whose name matches env/secret/key/pem/cred. |
| Result | **No credentials found.** `.env*` has always been ignored. No rotation is required on the basis of repository contents. |
| Note | `ai-service/__pycache__/main.cpython-312.pyc` is committed (compiled bytecode, no secrets) and has been removed and ignored. |
