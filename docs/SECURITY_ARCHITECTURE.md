# Security Architecture

Scope: web app, worker, CV service as implemented in Phase 1. Findings that motivated each control: `docs/audit/SECURITY_FINDINGS.md`.

## 1. Trust boundaries

| Boundary | Control |
|---|---|
| Browser → web app | Clerk session (HTTP-only cookie). Every API route authenticates in-handler (`withAuth`). Origin check on state-changing requests. Rate limits. Size limits. |
| Web app → PostgreSQL | Credentials from env only. All user-data queries filtered by internal `userId`. |
| Web/worker → Redis | Job payload contains only the analysis id; no personal data in Redis. |
| Worker → storage | Server-generated keys; signed, short-lived download URLs; SSRF-safe fetch; SHA-256 re-verification. |
| Worker → CV service | Bearer token (`AI_SERVICE_TOKEN`, ≥ 32 chars, constant-time compare). Image bytes only — the service has no URL-fetching capability. |
| Worker → LLM provider | API key in headers. Prompt contains only Saarthi-computed report data (no journal text, no identifiers, no images). Output schema-validated. |

## 2. Authentication

- `lib/auth/session.ts` is the single source of the current user. It reads Clerk's verified session (`auth()`), maps `clerkId` → internal `User.id` (creating the row on first use; `currentUser()` is called only then).
- Client-supplied user identifiers are never read. Request schemas are `.strict()`, so a body containing `userId` is rejected with 400.
- `proxy.ts` (Next 16's renamed middleware) redirects unauthenticated users away from `/dashboard/*`. API routes do not depend on it — they return JSON 401 themselves (defence in depth).
- **Development bypass:** `DEV_ALLOW_ANON` maps requests to a local dev user only when `NODE_ENV=development` **and** `APP_ENV=development`. Configuration validation rejects the flag in every other combination, so the process does not start. Tested: `tests/unit/config/env.test.ts`, `tests/integration/auth-and-ownership.test.ts`.

## 3. Authorization

- Ownership is enforced **in the query**: repository functions take `userId` and include it in `WHERE` (`findOwnedAnalysis`, `findOwnedActiveAsset`, `latest*Report`, …). There is no code path that loads a user-owned row by id alone and checks ownership afterwards.
- Foreign or non-existent ids both return **404** so ids cannot be probed.
- Analyses can only reference assets owned by the same user and uploaded for the same purpose.
- `requireAdmin()` exists for future admin routes (`User.role`). No admin endpoints exist yet.
- Verified by mutation testing: removing the `userId` filter from `findOwnedAnalysis` makes `Bob cannot read Alice's analysis` fail.

## 4. Input handling

| Control | Implementation |
|---|---|
| Validation | Zod schemas (`features/wellness/schemas.ts`), strict objects, physiological bounds. Pydantic models in the CV service (`extra="forbid"`). |
| JSON size | 32 KB default (`lib/api/body.ts`), enforced on declared length and while streaming. |
| Upload size | 10 MB image + 64 KB multipart overhead; `Content-Length` required; enforced before parsing. CV service enforces the same limit. |
| Error responses | Only `AppError` messages marked `expose` reach clients; validation errors list paths and messages, never submitted values. 5xx responses are generic with a `requestId`. |

## 5. File storage

- Image type is detected from **magic bytes** (JPEG/PNG/WebP). Dimensions are parsed from the header (320–8192 px, ≤ 40 MP) before any decoding (decompression-bomb guard). The browser's MIME type is ignored.
- Keys: `saarthi/<APP_ENV>/users/<internalUserId>/<skin|physical>/<uuid>`. No client input appears in the key; the legacy `folder` field is mapped to an enum, never used as a path.
- Cloudinary delivery type `authenticated`: the file is not reachable by public URL. Access uses `private_download_url` signed links expiring after 5 minutes (2 minutes for worker downloads).
- Deletion: `DELETE /api/assets/{id}` and account deletion remove the stored file; the metadata row is soft-deleted.
- Duplicate uploads by the same user (same SHA-256) are de-duplicated.
- **Not covered:** images uploaded before Phase 1 are public `upload`-type assets referenced by `imageUrl` on legacy rows. They remain public until migrated or deleted (completion report, blocker list).

## 6. SSRF

- The CV service accepts **bytes only**; the old `/analyze-skin` and `/analyze-fitness` URL endpoints return 410.
- The only server-side fetch of user-related content is the worker downloading the user's own stored file through `lib/security/safe-fetch.ts`: https only, default port, no credentials in URL, exact host allow-list (`STORAGE_ALLOWED_HOSTS`), IP literals refused, every DNS answer must be public (private, loopback, link-local incl. `169.254.169.254`, CGNAT, multicast, reserved, IPv4-mapped and NAT64 forms blocked), redirects not followed, content-type and size limits, timeout.
- Residual risk: DNS rebinding between the check and the connection; mitigated by the allow-list containing only the storage provider.

## 7. CSRF and CORS

- Clerk's session cookie is `SameSite=Lax`. In addition, `assertSameOrigin` rejects POST/PUT/PATCH/DELETE whose `Origin` header is present and not the app's own origin, `APP_URL`, or `ALLOWED_ORIGINS` (`"null"` is rejected).
- No CORS headers are emitted, so browsers block cross-origin reads. The CV service has no CORS (server-to-server only).

## 8. Rate limiting

Fixed window per internal user id, Redis-backed (`lib/security/rate-limit.ts`): reads 120/min, uploads 20/10 min, analyses 20/10 min, questionnaires 30/10 min, combined reports 5/h, export 3/h, delete 3/h. 429 responses include `Retry-After`. If Redis errors, the limiter **fails open** and logs `rate_limit.store_unavailable` — a deliberate availability trade-off. Without `REDIS_URL` an in-memory per-process store is used (development only).

## 9. Secrets and configuration

- Secrets come from environment variables only; `.env*` files are git-ignored (except `.env.example`, which contains no values).
- Validation errors name variables, never values. The logger redacts secret-like and personal keys.
- The CV service reads only its own environment (it no longer loads the web app's `.env`).
- Gemini keys are sent in `x-goog-api-key`, Anthropic via the SDK, OpenAI-compatible via `Authorization`.
- Repository history scan: no committed credentials (`docs/audit/SECURITY_FINDINGS.md` SEC-18).

## 10. Headers

`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera self only), `Strict-Transport-Security`, `X-Powered-By` removed. **CSP is not yet set** (Phase 4; requires Clerk-specific tuning).

## 11. Data protection

- Journal text is processed for the response only and never stored.
- Account export (`GET /api/account/export`) and deletion (`DELETE /api/account`, explicit confirmation phrase) are authenticated, rate limited and audited. Deletion removes stored files before database rows and then deletes the Clerk identity; the response states whether identity deletion succeeded.
- Audit log events: `asset.upload`, `asset.delete`, `analysis.create`, `report.questionnaire.create`, `account.export`, `account.delete`.

## 12. Dependency security

`npm run deps:check` runs `npm outdated` and `npm audit --omit=dev`. Phase 1 upgraded Next.js 16.2.6 → 16.4.6 to remove critical advisories (including a middleware/proxy bypass and several unauthenticated RCEs). Current audit status is recorded in the completion report.
