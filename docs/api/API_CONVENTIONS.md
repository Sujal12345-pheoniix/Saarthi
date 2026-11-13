# API Conventions (v1)

## Envelope

```jsonc
// success
{ "success": true, "data": { ... }, "requestId": "4f6c…" }
// failure
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "The request is invalid.", "details": { "issues": [{ "path": "mood", "message": "Too big" }] } }, "requestId": "4f6c…" }
```

Headers on every response: `x-request-id`, `x-api-version: 1`, `cache-control: no-store`. Clients may send `x-request-id` (8–128 chars of `[A-Za-z0-9._-]`) to correlate logs.

## Error codes

| HTTP | code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Body/params invalid; `details.issues` lists paths |
| 401 | `UNAUTHENTICATED` | No valid session |
| 403 | `FORBIDDEN` / `BAD_ORIGIN` | Not allowed / cross-origin state change |
| 404 | `NOT_FOUND` | Missing **or not yours** |
| 411 | `LENGTH_REQUIRED` | Upload without Content-Length |
| 413 | `PAYLOAD_TOO_LARGE` | Body over limit |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Wrong content type / not a supported image |
| 429 | `RATE_LIMITED` | See `Retry-After` |
| 503 | `QUEUE_UNAVAILABLE` / `NOT_CONFIGURED` / `SERVICE_UNAVAILABLE` | Dependency down or feature not configured |
| 500 | `INTERNAL_ERROR` | Generic; use `requestId` to find the log |

## Endpoints

| Method & path | Body | Returns |
|---|---|---|
| `GET /api/health` (public) | — | `{ status: "ok" }` |
| `POST /api/upload` | multipart: `file`, `purpose` = `skin`\|`physical` | `{ assetId, purpose, width, height, previewUrl }` |
| `DELETE /api/assets/{id}` | — | `{ assetId, deleted }` |
| `POST /api/analyze-skin` | `{ assetId, questionnaire?, idempotencyKey? }` | `{ analysisId, domain, status }` |
| `POST /api/analyze-fitness` | `{ assetId, questionnaire?, idempotencyKey? }` | `{ analysisId, domain, status }` |
| `GET /api/report/{analysisId}` | — | `{ status: QUEUED\|PROCESSING, attempts }` · `{ status: FAILED, errorCode, error }` · `{ status: COMPLETED, report }` |
| `POST /api/report/generate` | `{ idempotencyKey? }` | `{ analysisId, domain: "COMBINED", status }` |
| `GET /api/report/latest` | — | `{ report: CombinedReportView \| null }` |
| `GET /api/reports/{skin\|physical\|mental}` | — | `{ report: ReportView \| null }` (latest, any method) |
| `POST /api/reports/{skin\|physical\|mental}` | questionnaire | `{ report: ReportView }` (rule-based, synchronous) |
| `GET /api/history` | — | `{ history: [...] }` (50 most recent analyses) |
| `GET /api/progress` | — | `{ skin, physical, mental }` series |
| `GET /api/dashboard/summary` | — | latest scores, streak, 90-day progress |
| `GET /api/account/export` | — | full JSON export |
| `DELETE /api/account` | `{ confirm: "DELETE MY ACCOUNT" }` | `{ deleted, assetsDeleted, identityDeleted }` |

Schemas: `features/wellness/schemas.ts`. View-models: `features/reports/view-model.ts`.

Removed in Phase 1: `POST /api/skin/analyze`, `/api/mental/analyze`, `/api/physical/analyze` (trusted a body `userId`), and the `imageUrl` field of the analyze endpoints.

## Versioning strategy

- The current contract is **v1**, advertised by `x-api-version`. Paths stay unversioned while the only client is this web app, which deploys atomically with the API.
- Additive changes (new optional fields, new endpoints) stay in v1.
- A breaking change introduces `/api/v2/...` routes alongside v1; v1 is kept until clients have migrated, then removed with a changelog entry.
- Once a separately-deployed client exists (e.g. mobile app), all routes move under `/api/v1/` first.
