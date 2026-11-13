# Saarthi — Initial Repository Audit

Audit date: 2026-11-13 · Commit audited: `a0fc041` (`master`, 24 commits) · Auditor: Phase 1 engineering pass

This document records what the repository **actually contained** before Phase 1 changes. Detailed findings are split into:

- [SECURITY_FINDINGS.md](SECURITY_FINDINGS.md) — SEC-01 … SEC-18
- [ARCHITECTURE_FINDINGS.md](ARCHITECTURE_FINDINGS.md) — INT-01 … INT-09 (data integrity) and ARC-01 … ARC-13
- [TECHNICAL_DEBT.md](TECHNICAL_DEBT.md) — TD-01 … TD-17

## 1. Method

Every tracked file was read (≈4,000 lines excluding the lockfile). Imports were traced with repository-wide searches to confirm whether code is reachable. Git history (all commits) was scanned for credentials. Dependencies were installed and the toolchain was run. A feature was counted as existing only if a reachable code path implements it end to end — UI references alone were not counted.

## 2. Verified stack

| Layer | Found | Notes |
|---|---|---|
| Web | Next.js 16.2.6 (App Router), React 19.2.4, TypeScript 5 (`strict: true`), Tailwind 4 | `AGENTS.md` warns that Next 16 differs from earlier versions |
| Auth | Clerk (`@clerk/nextjs` 7) | Middleware protects `/dashboard(.*)` only; API routes self-check (inconsistently) |
| Database | PostgreSQL via Prisma 7 + `@prisma/adapter-pg`; `pgvector` extension declared | **No migrations**; schema applied with `db push` |
| Second database | MongoDB/Mongoose models | **Unreachable** — nothing imports them |
| Queue | Redis + BullMQ 5 | Worker started from `instrumentation.ts` inside the web server |
| Storage | Cloudinary (public `upload` type) | `uploadthing` packages installed but unused |
| AI service | Python FastAPI + OpenCV + MediaPipe (`ai-service/main.py`), Dockerfile, deployed on Render (URL hard-coded) | Unauthenticated, fetches arbitrary URLs |
| LLM | OpenAI-compatible endpoint (default NVIDIA DeepSeek R1) and Gemini 2.5 Flash via REST | `@google/genai` SDK installed but unused |
| Tests | 2 Python unit tests for blur/brightness helpers; `scripts/smoke-test.js` (manual, needs running server) | No TypeScript tests |
| CI/CD | None in repository | Vercel (web) and Render (AI service) inferred from commit messages and URLs |
| Tooling | ESLint 9 (`eslint-config-next`), no Prettier | `npm ci` fails (lockfile out of sync); Prisma 7 needs Node ≥ 20.19 |

## 3. Feature reality check

| Feature (product vision) | What exists | Real? |
|---|---|---|
| Skin intelligence | Upload → BullMQ → FastAPI OpenCV/MediaPipe face-region metrics → `SkinReport` | **Partly.** CV metrics are computed from pixels, but confidence is a constant, several fallbacks are constants, and an LLM "fallback" fabricates results from a URL (INT-01, INT-04). Results vanish on reload (ARC-01). |
| Skin questionnaire report | `lib/wellness-report.ts` deterministic formula | Real calculation from user input; "confidence" fabricated (INT-05). |
| Physical (posture) | MediaPipe Pose angles → scores | Angles are real; mobility is `posture + 5` (INT-04). Stock photo substituted when user uploads nothing (INT-02). |
| Physical questionnaire report | Formula + BMI | Real calculation; not reachable from UI (page always calls CV). |
| Mental wellness | Mood/stress/sleep/energy formula | Real calculation; anxiety/burnout columns are ad-hoc derivations (INT-08). Journal text not stored. |
| Unified wellness report | LLM synthesis over latest reports | Real LLM call; output unvalidated, defaults on missing fields (INT-03). |
| AI companion | Chat UI | **Mock** — `setTimeout` canned reply (INT-07). |
| Progress tracking | `ProgressHistory` rows written by CV path; `/api/progress` | Data real for CV path only; **dashboard chart is hard-coded** (INT-07). |
| Achievements | Rows on first skin/fitness report | Real but not displayed anywhere. |
| Daily habits | `DailyHabits` model | Model only; no API/UI. |
| Profiles / settings / data management | Settings page with static text | No profile, preferences, export or deletion. |

## 4. API inventory (before)

| Route | Method | Auth | Notes |
|---|---|---|---|
| `/api/analyze-skin` | POST | Clerk or `DEV_ALLOW_ANON` | Accepts arbitrary `imageUrl`; sync fallback |
| `/api/analyze-fitness` | POST | Clerk or `DEV_ALLOW_ANON` | Same |
| `/api/report/[id]` | GET | Clerk or bypass | Ownership check present (good) |
| `/api/report/generate` | POST | Clerk or bypass | Enqueues combined report; no job record |
| `/api/report/latest` | GET | Clerk or bypass | |
| `/api/reports/[domain]` | GET, POST | Clerk or bypass; dev fallback on DB error | Questionnaire reports |
| `/api/history` | GET | Clerk or bypass | Not used by UI |
| `/api/progress` | GET | Clerk or bypass | Not used by UI |
| `/api/upload` | POST | **None** | SEC-02 |
| `/api/skin/analyze` | POST | **None, trusts body `userId`** | SEC-01 |
| `/api/mental/analyze` | POST | **None, trusts body `userId`** | SEC-01 |
| `/api/physical/analyze` | POST | **None, trusts body `userId`** | SEC-01 |
| FastAPI `/analyze-skin`, `/analyze-fitness` | POST | **None** | SEC-03/04 |

## 5. Severity summary

| Severity | Security | Integrity | Architecture |
|---|---|---|---|
| Critical | 3 (SEC-01, 02, 03) | 2 (INT-01, 02) | — |
| High | 3 | 5 | 5 |
| Medium | 8 | 1 | 5 |
| Low / Info | 4 | 1 | 3 |

## 6. Phase 1 priorities derived from this audit

1. Close the critical holes: unauthenticated/IDOR routes, anonymous uploads, SSRF, AI-service auth.
2. Stop fabricated data from being produced or displayed.
3. Make PostgreSQL the single source of truth with real migrations and an analysis→report relationship.
4. Separate the worker; make queue behaviour explicit and observable.
5. Validated configuration, shared API infrastructure, tests and documentation.
