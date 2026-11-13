# Database Architecture

**Canonical store:** PostgreSQL 16 with the `pgvector` extension, accessed only through Prisma 7 (`@prisma/adapter-pg`). MongoDB/Mongoose was removed: it was never imported by any code path (audit ARC-02), so there was no MongoDB data to migrate.

Schema: `prisma/schema.prisma`. Migrations: `prisma/migrations/`.

## 1. Entity map

```
User ─┬─ UserProfile (1:1)          UserPreferences (1:1)          ConsentRecord (append-only)
      ├─ UploadedAsset ──┐
      ├─ Analysis ───────┼─ AnalysisInput (1:1)   AnalysisResult (1:1)
      │     │ inputAssetId┘
      │     └─ exactly one of: SkinReport | PhysicalReport | MentalWellnessReport | CombinedWellnessReport (analysisId UNIQUE)
      ├─ ProgressHistory (sourceReportId)       Achievement (UNIQUE userId+code)
      ├─ DailyHabit (UNIQUE userId+date)        JournalEntry      Recommendation
      ├─ AIConversation ─ AIMessage (embedding vector(1536))
      ├─ Notification
      └─ AuditLog (actorUserId SET NULL on user deletion)
```

## 2. Table decisions

| Table | Purpose | Notes |
|---|---|---|
| `User` | Internal identity, `clerkId` unique | `role` (USER/ADMIN). Personal attributes moved to `UserProfile`. |
| `UserProfile`, `UserPreferences` | Optional profile and settings | 1:1, PK = `userId`. |
| `ConsentRecord` | Consent history | Append-only; latest row per type is current. UI capture is Phase 3. |
| `UploadedAsset` | Ownership + verified metadata of stored images | `storageKey` unique and server-generated; `mimeType`/dimensions from the file itself; `sha256` re-checked before analysis; soft-deleted (`status`, `deletedAt`) so reports keep a consistent reference after the file is removed. |
| `Analysis` | The job | `domain` and `status` enums; `attempts`, `errorCode`, user-safe `errorMessage`; `queuedAt/startedAt/completedAt`; `UNIQUE(userId, idempotencyKey)`. |
| `AnalysisInput` | Validated questionnaire input | Separate so inputs can be purged independently. Journal text is never stored (only `journalProvided`). |
| `AnalysisResult` | Raw engine output, engine and version, duration | Reproducibility and audit. This is the "AnalysisResult" of the target design; the typed domain reports below are the normalised results (a generic result table duplicating them was not created). |
| `SkinReport`, `PhysicalReport`, `MentalWellnessReport` | One table per domain for **all** methods | `method` + `engineVersion` + nullable `confidence`; `metrics` JSON for method-specific detail. Replaces 5 legacy tables (audit ARC-01). |
| `CombinedWellnessReport` | LLM narrative + Saarthi-computed overall score | `model`, `sourceReportIds`. |
| `ProgressHistory` | Time series of scores | `domain`, `metric`, `value`, `sourceReportId`. |
| `Achievement` | Badges | `UNIQUE(userId, code)` prevents duplicates under concurrency. |
| `DailyHabit`, `JournalEntry`, `Recommendation`, `Notification` | Schema for upcoming features | No API yet. |
| `AIConversation`, `AIMessage` | Companion chat | Legacy rows (one per message) migrated into conversations. |
| `AuditLog` | Security events | Survives account deletion with the actor cleared. Metadata must not contain health data. |
| Subscription | — | Not created: there is no billing in the product. |

### JSON columns (and why)
`metrics` (method-specific measurements and `legacy` values), `detectedIssues`/`recommendations`/`risks`/`actionPlan` (ordered string lists rendered as-is), `AnalysisInput.questionnaire` (versioned by `schemaVersion`), `AnalysisResult.rawOutput`, `AuditLog.metadata`. Everything that is queried or aggregated is a typed column.

### Deletion
- Account deletion: stored files are removed first; if any removal fails nothing is deleted from the database (retry-safe). Then `DELETE User` cascades to all user data. `AuditLog.actorUserId` is set to NULL.
- Soft deletion is used only for `UploadedAsset` (justified above). Health data is hard-deleted.

### Ownership
Every user-owned table has `userId` with a foreign key; repository functions always filter by the server-resolved `userId` (see `docs/SECURITY_ARCHITECTURE.md`).

## 3. Migrations

| Migration | What it does |
|---|---|
| `20261113000000_baseline` | Exactly the pre-Phase-1 schema (generated from the audited `schema.prisma`). New databases apply it normally; **existing databases created with `db push` must mark it as applied** (below). |
| `20261113000100_phase1_foundation` | Hand-written, single transaction. Transforms data in place (see § 4), then builds the new structure. |

Verification performed (and automated in `tests/integration/migration.test.ts`): baseline → legacy seed covering every table → Phase 1 migration → assertions on transformed rows → `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` returns **no differences**. A deliberately failing run also confirmed the migration rolls back completely.

### Applying to an existing (db-push) database
```bash
# 1. Back up first (e.g. Neon branch or pg_dump).
# 2. Tell Prisma the baseline already exists:
npm run db:baseline            # prisma migrate resolve --applied 20261113000000_baseline
# 3. Apply Phase 1:
npm run db:migrate:deploy
```
If the live database differs from the audited schema (manual edits), step 3 fails inside the transaction and nothing changes; compare with `npx prisma migrate diff --from-config-datasource --to-migrations prisma/migrations`.

## 4. Phase 1 migration — data decisions

| Legacy data | Becomes | Reason |
|---|---|---|
| `SkinReport` (CV) | `SkinReport` with `method = LEGACY_UNVERIFIED`, `confidence` → `metrics.legacy.confidence`, `confidence = NULL` | The old worker could fabricate these with an LLM (INT-01); provenance cannot be proven. |
| `SkinAnalysis` (questionnaire) | `SkinReport`, `method = QUESTIONNAIRE_RULES`; `acneScore` (actually the overall score) → `skinScore`; `hydrationScore = 100 − drynessScore`; other derived values → `metrics.legacy` | Deterministic formula; formula "confidence" removed (INT-05). |
| `FitnessReport` (CV) | `PhysicalReport`, `LEGACY_UNVERIFIED`; `mobilityScore` (= posture + 5) → `metrics.legacy` | Not a measurement (INT-04). |
| `PhysicalHealthAnalysis` | `PhysicalReport`, `QUESTIONNAIRE_RULES`; `waterLiters = hydration / 40`; `activityLevel` (actually the goal) → `goal` | Inverse of the old transform. |
| `MentalHealthAnalysis` | `MentalWellnessReport`, `QUESTIONNAIRE_RULES`; `moodScore` → `wellnessScore`; `sleepHours = sleepScore / 12`; anxiety/burnout → `metrics.legacy` | Ad-hoc derivations are not stored as measurements (INT-08). |
| `Analysis.type/status/resultId` | enums + `analysisId` FK on reports | COMPLETED without a findable report → FAILED `LEGACY_REPORT_MISSING`; in-flight jobs (retired queue) → FAILED `INTERRUPTED_BY_UPGRADE`; legacy error text (could contain provider responses) → generic message. |
| `ProgressHistory.metricType/score/date` | `domain/value/recordedAt` | Unknown metric types abort the migration rather than being guessed. |
| `Achievement` | gains `code`; duplicates keep `code = NULL` | Enables the uniqueness guarantee. |
| `CombinedWellnessReport` | `method = LEGACY_UNVERIFIED` | Old overall scores were model-generated (or defaulted to 70). |
| `DailyHabits` | `DailyHabit`, one row per user per day (latest wins) | Table was never written by code. |
| `AIConversation` (rows were messages) | `AIConversation` per user + `AIMessage` rows | Structure for the companion. |
| `User.age/gender/lifestyle` | `UserProfile` | Separation of identity and personal data. |

## 5. Commands

```bash
npm run db:generate         # prisma generate
npm run db:migrate:dev      # create a new migration during development
npm run db:migrate:deploy   # apply migrations (CI/production)
npm run db:migrate:status   # show applied/pending
npm run db:baseline         # one-time, for databases created with db push
```
