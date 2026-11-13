# Architecture & Data-Integrity Findings — Initial Audit (Phase 1)

Audit date: 2026-11-13 · Commit audited: `a0fc041`

Two families of findings: **ARC** (structure, persistence, runtime) and **INT** (data integrity — places where the product shows or stores values that were not actually measured or computed). INT findings matter as much as security findings for a health product: the operating rules forbid fabricated metrics, confidence values and AI results.

---

## Data integrity

### INT-01 — LLM "analyses" images it never sees (fabricated CV results)
| | |
|---|---|
| File | `lib/queue/reportWorker.ts:12-99` (`runFallbackAnalysis`) |
| Severity | **Critical** |
| Problem | When the CV service fails, the worker sends the image **URL as text** to a text-only LLM with the instruction "Image URL (simulated vision inspection)" and saves the returned skin/posture scores and confidence as a real report. |
| Impact | Users receive invented skin and posture scores presented as computer-vision results; progress history is polluted. |
| Solution | Remove the fallback. A CV failure marks the analysis `FAILED` with a user-facing reason. |
| Verification | `tests/integration/analysis-lifecycle.test.ts` › "an image-quality rejection fails permanently … no report" and "unexpected errors are stored as a generic message". The fallback code was deleted. |
| Status | Resolved. |

### INT-02 — Stock photo of a stranger analysed as the user's body
| | |
|---|---|
| File | `components/dashboard/reports/PhysicalReportView.tsx:126` |
| Severity | **Critical** |
| Problem | If no photo is uploaded the client submits an Unsplash stock image URL; its posture analysis is saved as the user's report. |
| Solution | Without a photo, the physical page generates the questionnaire-based (rule) report; with a photo, it runs posture analysis on the user's own uploaded asset only. |
| Status | Resolved. |

### INT-03 — Default values substituted for missing analysis output
| | |
|---|---|
| Files | `lib/ai/directAnalyzer.ts:34-66` (`?? 75`, `?? 90`, `["Dry skin texture"]`, `["Mild shoulder tilt"]`); `lib/queue/reportWorker.ts:236` (`overallHealthScore ?? 70`) |
| Severity | **High** |
| Solution | Zod-validate service/LLM responses; missing or invalid fields fail the job. |
| Status | Resolved. |

### INT-04 — Constants presented as measurements in the CV service
| | |
|---|---|
| File | `ai-service/main.py` |
| Severity | **High** |
| Problem | Skin `confidence=95` is hard-coded; `mobility_score = posture_score + 5` (mobility is not measured from a single static photo); `dryness_score = 30` and `skin_uniformity_score = 75` when the region crop failed; the summary always says "mild texture fluctuations and balanced oil levels" regardless of the data. |
| Solution | Unmeasured values are returned as `null` and labelled "not measured". Summary sentences are derived from the computed metrics. Skin `confidence` is `null` until Phase 2 introduces a calibrated measure. |
| Status | Resolved (honest nulls). Algorithm calibration is Phase 2. |

### INT-05 — Formula "confidence" on questionnaire reports
| | |
|---|---|
| Files | `lib/wellness-report.ts:47,107,158`; `app/api/reports/[domain]/route.ts:115,164` |
| Severity | **High** |
| Problem | e.g. `confidence: clamp(84 + hydrationBonus/2 - concernPenalty, 72, 98)` — a number with no statistical meaning, displayed as "confidence". |
| Solution | Rule-based reports carry `confidence: null` and `method: QUESTIONNAIRE_RULES`; the UI shows "Rule-based estimate" instead of a percentage. The scoring formulas themselves are kept (they are deterministic calculations from user input) and documented for Phase 2 review. |
| Status | Resolved. |

### INT-06 — UI invents confidence when absent
| | |
|---|---|
| Files | `SkinReportView.tsx:327` (`?? 91`), `PhysicalReportView.tsx:293` (`?? 89`), `MentalReportView.tsx:154` (`?? 90`) |
| Severity | **High** |
| Status | Resolved (renders "not measured"). |

### INT-07 — Hard-coded dashboard metrics and mock AI companion
| | |
|---|---|
| Files | `app/dashboard/page.tsx` (Overall 88%, "Calm", "5 Days" streak, fixed weekly chart, fixed "stress elevated" tip); `app/dashboard/ai/page.tsx` (`setTimeout` canned reply; greeting claims "I've analyzed your recent data") |
| Severity | **High** |
| Solution | Phase 1 wires the overview to a real `/api/dashboard/summary` (latest scores, real progress series, empty states). The companion is shown as "not yet available" until Phase 3 implements it against a real model — no mock replies. |
| Status | Resolved (honest states). Full companion is Phase 3. |

### INT-08 — Derived values stored as if measured
| | |
|---|---|
| File | `app/api/reports/[domain]/route.ts:335-366` |
| Severity | **Medium** |
| Problem | `anxietyLevel`, `burnoutRisk`, `drynessScore`, `oiliness` (`sunExposure*10`), `pigmentation` (`concerns.length*15`) and `hydration` (`liters*40`) are ad-hoc transforms of other answers, stored in columns named like measurements. |
| Solution | The consolidated schema stores what the user reported (`stressLevel`, `moodRating`, `energyRating`, `sleepHours`, …) plus the computed score and its `method`. Ad-hoc derived columns are not written for new reports. Legacy values are kept only inside `metrics.legacy` for audit. |
| Status | Resolved. |

### INT-10 — Posture scores pinned to the minimum for frontal photos (found during Phase 1)
| | |
|---|---|
| File | `ai-service/main.py` (posture-cv@1: `shoulder_tilt = abs(degrees(atan2(dy, dx)))` with `dx = right.x − left.x`) |
| Severity | **High** |
| Problem | MediaPipe's *left* landmarks are the subject's left, i.e. on the image right for a person facing the camera, so `dx < 0` and a perfectly level shoulder line measures ≈180°. Every frontal photo was flagged with shoulder/hip imbalance and the posture score clamped to its floor of 30. The neck angle had the same orientation problem. |
| Impact | Posture results for frontal photos were systematically wrong, regardless of the person's actual posture. |
| Solution | `line_tilt()` / `forward_angle()` fold angles into [0°, 90°] independent of landmark order (`ai-service/app/services/fitness.py`, posture-cv@2). |
| Verification | `ai-service/tests/test_posture_geometry.py` (level line = 0° in both orders; known tilts). |
| Status | Resolved. Legacy posture reports are labelled `LEGACY_UNVERIFIED`. |

### INT-09 — Settings page states false security facts
| | |
|---|---|
| File | `app/dashboard/settings/page.tsx` ("Clerk protects the dashboard and report APIs") |
| Severity | **Low** |
| Status | Text corrected to describe the actual implementation. |

---

## Architecture

### ARC-01 — Two disconnected persistence paths per domain
| | |
|---|---|
| Files | `prisma/schema.prisma`; `app/api/reports/[domain]/route.ts`; `lib/queue/reportWorker.ts` |
| Severity | **High** |
| Problem | Questionnaire reports write `SkinAnalysis` / `PhysicalHealthAnalysis` / `MentalHealthAnalysis`; CV reports write `SkinReport` / `FitnessReport`. `GET /api/reports/skin` reads only `SkinAnalysis`, so a completed CV skin scan disappears from the page on reload. |
| Solution | One report table per domain (`SkinReport`, `PhysicalReport`, `MentalWellnessReport`) with a `method` column; data migrated by SQL in `prisma/migrations/20261113000100_phase1_foundation`. |
| Verification | Migration applied to a database seeded with legacy rows (`tests/integration/migration.test.ts`, including a schema-drift check). |
| Status | Resolved. |

### ARC-02 — Unused MongoDB/Mongoose layer
| | |
|---|---|
| Files | `lib/mongodb.ts`, `models/*.ts`, dependency `mongoose` |
| Severity | **High** (confusion, dead dependency; `lib/mongodb.ts` throws at import time without `MONGODB_URI`) |
| Evidence | No file imports `lib/mongodb` or `models/*` (repository-wide search). No API writes to MongoDB. |
| Solution | Removed. There is no MongoDB data path to migrate. PostgreSQL is canonical. |
| Status | Resolved. |

### ARC-03 — Queue worker runs inside the Next.js server
| | |
|---|---|
| Files | `instrumentation.ts`, `lib/queue/reportWorker.ts`, `lib/queue/redis.ts` |
| Severity | **High** |
| Problem | The worker is started from `instrumentation.ts`, so on Vercel it lives and dies with serverless invocations and jobs stall. `lib/queue/redis.ts` opens a connection at import time and silently falls back to `localhost`. |
| Solution | Standalone worker process `workers/analysis/index.ts` (`npm run worker`). Redis connections are created lazily from validated configuration. |
| Status | Resolved. |

### ARC-04 — Silent fallbacks change behaviour without anyone noticing
| | |
|---|---|
| Files | `app/api/analyze-skin/route.ts:79`, `app/api/analyze-fitness/route.ts:79` |
| Severity | **High** |
| Problem | Any enqueue error (not only `ECONNREFUSED`) triggers synchronous processing inside the request (Vercel timeout risk). |
| Solution | Execution mode is explicit configuration: `ANALYSIS_EXECUTION_MODE=queue` (default) or `inline`. Both run the same processor. In `queue` mode an unavailable queue returns `503 QUEUE_UNAVAILABLE` and marks the analysis `FAILED`. |
| Status | Resolved. |

### ARC-05 — No migrations
| | |
|---|---|
| Severity | **High** |
| Problem | `prisma/migrations` does not exist; the database was created with `db push`. |
| Solution | `20261113000000_baseline` reproduces the audited schema exactly (existing databases mark it applied with `prisma migrate resolve`); `20261113000100_phase1_foundation` performs the consolidation with data migration. |
| Status | Resolved. |

### ARC-06 — Polymorphic job→report link without integrity
| | |
|---|---|
| File | `prisma/schema.prisma` (`Analysis.resultId`, `type`, `status` free-text) |
| Severity | **Medium** |
| Solution | Each report has a unique nullable FK `analysisId`; `domain` and `status` are enums. |
| Status | Resolved. |

### ARC-07 — Auth logic copy-pasted eight times with divergent behaviour
| | |
|---|---|
| Severity | **Medium** |
| Solution | `lib/auth/session.ts` + `withApi` wrapper. |
| Status | Resolved. |

### ARC-08 — Dead AI code and unused dependencies
| | |
|---|---|
| Files | `lib/ai/orchestrator.ts`, `lib/ai/agents/*`, `lib/ai/gemini.ts`, `lib/ai/prompts.ts`, `lib/validations/ai.ts`; packages `uploadthing`, `@uploadthing/react`, `@google/genai`, `zustand`, `mongoose`, `clsx`, `tailwind-merge` |
| Evidence | No imports outside the dead files themselves. `SkinAgent` passes the image URL as text "for vision if supported". |
| Solution | Removed (recoverable from git history `a0fc041`). Phase 2 designs the multi-agent layer on the new provider abstraction. |
| Status | Resolved. |

### ARC-09 — Three LLM integrations with inconsistent defaults
| | |
|---|---|
| Files | `lib/ai/gemini.ts` (NVIDIA DeepSeek default), `lib/queue/reportWorker.ts` (Gemini native or OpenAI-compatible) |
| Severity | **Medium** |
| Solution | `server/integrations/llm/` with one interface and explicit `LLM_PROVIDER` (`anthropic`, `gemini`, `openai_compatible`); no implicit provider defaults. |
| Status | Resolved. |

### ARC-10 — Combined report has no job record
| | |
|---|---|
| Files | `app/api/report/generate/route.ts`, `app/dashboard/reports/page.tsx` |
| Severity | **Medium** |
| Problem | The UI polls `/api/report/latest` and waits for the id to change; failures are invisible (40 s timeout then `alert`). |
| Solution | Combined generation creates an `Analysis` (`domain=COMBINED`) and the UI polls `/api/report/{analysisId}` like the other domains. |
| Status | Resolved. |

### ARC-11 — Python service is a single module with per-request model construction
| | |
|---|---|
| File | `ai-service/main.py` |
| Severity | **Low** |
| Problem | `FaceMesh`/`Pose` instances are created per request and never closed. |
| Solution | Package layout `ai-service/app/{api,core,services,schemas,security}`; models used as context managers. |
| Status | Resolved. |

### ARC-12 — Next.js 16 conventions
| | |
|---|---|
| File | `middleware.ts` |
| Severity | **Low** |
| Problem | Next.js 16 renamed the `middleware` file convention to `proxy` (see `node_modules/next/dist/docs`). |
| Status | Resolved: renamed to `proxy.ts` with a default export, per `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`. The build lists it as "Proxy (Middleware)". |

### ARC-13 — Non-reproducible installs
| | |
|---|---|
| Files | `package.json`, `package-lock.json` |
| Severity | **Medium** |
| Problem | `npm ci` fails: lockfile out of sync (`Missing: gcp-metadata@7.0.1`). Prisma 7 requires Node ≥ 20.19 but no `engines` field exists; the audit machine had Node 20.18 and `npm install` failed in Prisma's preinstall. |
| Solution | Lockfile regenerated; `engines.node` and `.nvmrc` added. |
| Status | Resolved. |
