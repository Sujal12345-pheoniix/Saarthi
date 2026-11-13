# Technical Debt Register — Initial Audit (Phase 1)

Audit date: 2026-11-13 · Commit audited: `a0fc041`

Items are ordered by priority. "Phase" is the phase that owns the fix. Items fixed in Phase 1 are listed so the history is complete.

| ID | File(s) | Problem | Severity | Impact | Proposed solution | Verification | Phase / status |
|---|---|---|---|---|---|---|---|
| TD-01 | whole repo | No automated tests except two OpenCV helper tests in `ai-service/test_analysis.py` | High | Regressions undetected | Vitest (TS) + pytest (Python) foundation; real Postgres/Redis in integration tests | `npm test`, `pytest` | P1 — done |
| TD-02 | API routes, components | Pervasive `any` (`catch (error: any)`, `body: any`, `questionnaire: any`) | Medium | Type errors reach runtime | Typed request schemas (Zod), `unknown` in catches, typed client helper | `npm run typecheck`, `npm run lint` | P1 for server code; remaining UI `any` in P3 |
| TD-03 | `README.md` | create-next-app boilerplate; no setup, env or architecture info | Medium | Onboarding friction | Real README + `docs/` | Review | P1 — done |
| TD-04 | repo root | No `.env.example`; env vars discoverable only by reading code | Medium | Misconfiguration | `.env.example` + validated schema | `tests/config/env.test.ts` | P1 — done |
| TD-05 | `package.json` `ai-dev` | Windows-only path syntax; `uvicorn ai-service.main:app` is not importable (hyphen) | Low | Script never worked | `ai:dev` script using `ai-service/` as cwd | Manual | P1 — done |
| TD-06 | `scripts/smoke-test.js` | Uploads an SVG without auth to a public endpoint | Low | Encourages insecure behaviour | Removed; replaced by authenticated integration tests | — | P1 — done |
| TD-07 | `ai-service/__pycache__` | Compiled bytecode committed | Low | Noise | Removed + `.gitignore` | `git ls-files` | P1 — done |
| TD-08 | `lib/prisma.ts` | `Proxy`-wrapped client with `any` casts and logging | Low | Obscures errors | Plain lazy singleton | Typecheck | P1 — done |
| TD-09 | `components/dashboard/reports/*View.tsx` | Large (276–592 line) client components mixing data fetching, polling, mapping and presentation | Medium | Hard to test | Extract `lib/api/client.ts` (done in P1); split into feature hooks/components | — | P3 |
| TD-10 | `lib/wellness-report.ts` | Hand-tuned scoring constants without references | Medium | Scores not evidence-based | Document formulas, review with domain sources, version them (`engineVersion`) | — | P1 versioning done; formula review P2 |
| TD-11 | `ai-service/main.py` | Thresholds (blur 60, brightness 40/240, colour ranges) uncalibrated | Medium | Accuracy unknown | Calibration dataset and evaluation harness | — | P2 |
| TD-12 | Prettier | No formatter configured; inconsistent quotes/semicolons | Low | Noisy diffs | `.prettierrc` + `format` scripts; new/changed files formatted, repository-wide reformat deferred to avoid a giant diff | `npm run format:check` on changed files | P1 config; full reformat P3 |
| TD-13 | `next.config.ts` | No CSP | Medium | XSS blast radius | CSP tuned for Clerk | — | P4 |
| TD-14 | Observability | `console.log` only; no request correlation | Medium | Hard to debug | Structured JSON logger with request IDs (P1); log shipping/metrics/tracing (P4) | — | P1 partial |
| TD-15 | Migrations | Old public Cloudinary images referenced by `imageUrl` on legacy rows | Medium | Privacy | Re-upload as `authenticated` or delete with user consent | — | P4 runbook |
| TD-16 | `AIMessage.embedding` | `vector(1536)` column requires pgvector and is never written | Low | Extension dependency without use | Keep for Phase 3 retrieval; document requirement | — | P3 |
| TD-17 | Dependency health | No automated audit | Low | Vulnerable deps unnoticed | `npm run deps:check` (outdated + audit); Dependabot in P4 | — | P1 script |
| TD-18 | `components/**` | 5 ESLint `no-img-element` warnings (blob previews and short-lived signed URLs) | Low | Unoptimised images | Use `next/image` with `unoptimized` for blob/signed URLs | `npm run lint` | P3 |
| TD-19 | `workers/analysis/index.ts` | SIGTERM/SIGINT graceful shutdown could not be exercised on the Windows audit host (no POSIX signal delivery through `npx`) | Medium | Unverified drain behaviour on deploy | Verify in the Linux deployment target (container stop → `worker.shutdown` log, in-flight job completes or is retried) | Container stop test | P4 |
| TD-20 | `ai-service/tests` | No positive-path CV fixtures: tests prove rejections (blur, dark, no face, no pose) and geometry, but no licensed face/body photos are available to assert end-to-end scores | High | Score regressions undetected | Consented, licensed golden images + expected-range assertions | `npm run ai:test` | P2 |
| TD-21 | Legacy Cloudinary assets | Pre-Phase-1 uploads are public `upload`-type assets | Medium | Privacy | Migrate to `authenticated` or delete (runbook) | Cloudinary admin listing | P4 |
| TD-22 | Web app runtime | End-to-end run of the web app against real Clerk was not possible without project Clerk keys | Medium | Integration gap | Run with real keys in staging | Manual + Phase 4 E2E | P4 |
